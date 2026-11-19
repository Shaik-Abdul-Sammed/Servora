import { ThermalReceiptFormatter } from './printer.ts';
import type { ServerEvent, Order } from '../../../packages/shared-types/src/index.ts';

const CLOUD_URL = process.env.ABIRUCHI HOTEL_API_URL || 'http://localhost:3001';

export class POSBridgeDaemon {
  private active = false;

  public start() {
    this.active = true;
    console.log(`[Abiruchi Hotel POS Bridge] Initialized. Connecting to ${CLOUD_URL}/api/v1/events...`);
    this.connect();
  }

  private async connect() {
    try {
      const res = await fetch(`${CLOUD_URL}/api/v1/events`);
      if (!res.ok || !res.body) {
        throw new Error(`Failed to connect to SSE stream: ${res.statusText}`);
      }

      console.log(`[Abiruchi Hotel POS Bridge] Connected to Cloud Order Stream.`);
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
      console.warn(`[Abiruchi Hotel POS Bridge] Connection lost, retrying in 5s...`, err);
      setTimeout(() => this.connect(), 5000);
    }
  }

  public async handleOrderCreated(order: Order) {
    console.log(`\n================== [ESC/POS PRINTER JOB] ==================`);
    const asciiReceipt = ThermalReceiptFormatter.toAsciiReceipt(order);
    console.log(asciiReceipt);

    const printerHost = process.env.PRINTER_HOST;
    const printerPort = parseInt(process.env.PRINTER_PORT || '9100', 10);
    const escBytes = ThermalReceiptFormatter.toEscPos(order);

    if (printerHost) {
      console.log(`[Abiruchi Hotel POS Bridge] Dispatching ${escBytes.length} bytes to Network Printer at ${printerHost}:${printerPort}...`);
      const success = await ThermalReceiptFormatter.printToNetwork(printerHost, printerPort, escBytes);
      if (success) {
        console.log(`[Abiruchi Hotel POS Bridge] ✓ Hardware print successful.`);
      } else {
        console.warn(`[Abiruchi Hotel POS Bridge] ✗ Network printer unavailable, queued locally.`);
      }
    } else {
      console.log(`[Abiruchi Hotel POS Bridge] Simulated ESC/POS binary (${escBytes.length} bytes) to Virtual Printer.`);
    }
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
