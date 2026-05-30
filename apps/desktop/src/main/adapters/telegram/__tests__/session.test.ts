import { describe, expect, it } from 'vitest';
import { buildOfflineSession } from '../session';

const HEX_256 = 'a'.repeat(512);

describe('buildOfflineSession', () => {
  it('builds a v3 StringSessionData for a valid DC + 256-byte authKey', () => {
    const data = buildOfflineSession({ authKeyHex: HEX_256, dcId: 2 });
    expect(data.version).toBe(3);
    expect(data.authKey).toBeInstanceOf(Uint8Array);
    expect(data.authKey.length).toBe(256);
    expect(data.primaryDcs.main.id).toBe(2);
    expect(data.primaryDcs.media.id).toBe(2);
  });

  it('throws on unknown DC ids', () => {
    expect(() => buildOfflineSession({ authKeyHex: HEX_256, dcId: 99 })).toThrow(/DC/);
  });

  it('throws when authKey is not 256 bytes', () => {
    expect(() =>
      buildOfflineSession({ authKeyHex: 'a'.repeat(510), dcId: 1 }),
    ).toThrow(/256/);
  });

  it('throws on non-hex characters', () => {
    expect(() =>
      buildOfflineSession({ authKeyHex: 'z'.repeat(512), dcId: 1 }),
    ).toThrow(/hex/);
  });

  it('accepts the lowercase form of valid hex', () => {
    const data = buildOfflineSession({
      authKeyHex: 'deadbeef'.repeat(64),
      dcId: 1,
    });
    expect(data.authKey[0]).toBe(0xde);
    expect(data.authKey[1]).toBe(0xad);
    expect(data.authKey[2]).toBe(0xbe);
    expect(data.authKey[3]).toBe(0xef);
  });
});
