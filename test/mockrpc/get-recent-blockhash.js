// @flow


import {Account} from '@solana/web3.js';

import {url} from '../url';
import {mockRpc} from '../__mocks__/node-fetch';

export function mockGetRecentBlockhash() {
  const recentBlockhash = new Account();

  mockRpc.push([
    url,
    {
      method: 'getRecentBlockhash',
      params: [],
    },
    {
      error: null,
      result: [
        recentBlockhash.publicKey.toBase58(),
        {
          lamportsPerSignature: 42,
          burnPercent: 50,
          maxLamportsPerSignature: 42,
          minLamportsPerSignature: 42,
          targetLamportsPerSignature: 42,
          targetSignaturesPerSlot: 42,
        },
      ],
    },
  ]);
}
