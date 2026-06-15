import { DJSNextClient } from '../client.js';

describe('DJSNextClient', () => {
  it('should instantiate without throwing', () => {
    const client = new DJSNextClient({ intents: [] });
    expect(client).toBeDefined();
  });
});
