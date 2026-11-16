import { ThermalReceiptFormatter } from './printer.ts';
import type { ServerEvent, Order } from '../../../packages/shared-types/src/index.ts';

const CLOUD_URL = process.env.SERVORA_API_URL || 'http://localhost:3001';

export class POSBridgeDaemon {
  private active = false;

  public start() {
    this.active = true;
    console.log(`[Servora POS Bridge] Initialized. Connecting to ${CLOUD_URL}/api/v1/events...`);
    this.connect();
  }

  private async connect() {
    try {
      const res = await fetch(`${CLOUD_URL}/api/v1/events`);
      if (!res.ok || !res.body) {
        throw new Error(`Failed to connect to SSE stream: ${res.statusText}`);
      }

      console.log(`[Servora POS Bridge] Connected to Cloud Order Stream.`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (this.active) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const match = block.match(/^data:\s*(.+)$/m);
          if (match && match[1]) {
            try {
              const event: ServerEvent<Order> = JSON.parse(match[1]);
              if (event.type === 'ORDER_CREATED') {
                this.handleOrderCreated(event.payload);
              }
            } catch (err) {
              // Ignore ping or heartbeat
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Servora POS Bridge] Connection lost, retrying in 5s...`, err);
      setTimeout(() => this.connect(), 5000);
    }
  }

  public handleOrderCreated(order: Order) {
    console.log(`\n================== [ESC/POS PRINTER JOB] ==================`);
    const asciiReceipt = ThermalReceiptFormatter.toAsciiReceipt(order);
    console.log(asciiReceipt);
    console.log(`[Servora POS Bridge] Sent ESC/POS binary (${ThermalReceiptFormatter.toEscPos(order).length} bytes) to Thermal Printer.`);
  }

  public stop() {
    this.active = false;
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('bridge.ts')) {
  const daemon = new POSBridgeDaemon();
  daemon.start();
}
