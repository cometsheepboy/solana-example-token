// @flow

import fs from 'mz/fs';
import {Connection, BpfLoader, PublicKey, Token, TokenAmount} from '@solana/web3.js';
import {mockRpc, mockRpcEnabled} from './__mocks__/node-fetch';
import {url} from './url';
import {newAccountWithLamports} from './new-account-with-lamports';
import {mockGetRecentBlockhash} from './mockrpc/get-recent-blockhash';
import {sleep} from '../src/client/util/sleep';

// // The default of 5 seconds is too slow for loading larger BPF programs
jest.setTimeout(120000);

function mockGetSignatureStatus(result: Object = {Ok: null}) {
  mockRpc.push([
    url,
    {
      method: 'getSignatureStatus',
    },
    {
      error: null,
      result,
    },
  ]);
}
function mockSendTransaction() {
  mockRpc.push([
    url,
    {
      method: 'sendTransaction',
    },
    {
      error: null,
      result:
        '3WE5w4B7v59x6qjyC4FbG2FEKYKQfvsJwqSxNVmtMjT8TQ31hsZieDHcSgqzxiAoTL56n2w5TncjqEKjLhtF4Vk',
    },
  ]);
}

// Loaded token program's program id
let programId: PublicKey;

test('load token program', async () => {
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }

  const connection = new Connection(url);
  const from = await newAccountWithLamports(connection, 100000);
  const data = await fs.readFile(
    '../solana/programs/bpf/target/bpfel-unknown-unknown/release/solana_bpf_rust_token.so',
  );
  console.log("Loading BPF program, may take a bit...");
  programId = await BpfLoader.load(connection, from, data);
});

// A token created by the next test and used by all subsequent tests
let testToken: Token;

// Initial owner of the token supply
let initialOwner;
let initialOwnerTokenAccount: PublicKey;

test('create new token', async () => {
  const connection = new Connection(url);
  // TODO connection._disableBlockhashCaching = mockRpcEnabled;
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }
  if (programId == null){
    console.log('test skipped, requires "load tokeen program" to succeed');
    return;
  }

  initialOwner = await newAccountWithLamports(connection, 1024);

  {
    // mock SystemProgram.createAccount transaction for Token.createNewToken()
    mockGetRecentBlockhash();
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.newAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus(null);
    mockGetSignatureStatus();

    // mock SystemProgram.createAccount transaction for Token.createNewToken()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.createNewToken() transaction
    mockSendTransaction();
    mockGetSignatureStatus(null);
    mockGetSignatureStatus();
  }

  [testToken, initialOwnerTokenAccount] = await Token.createNewToken(
    connection,
    initialOwner,
    new TokenAmount(10000),
    'Test token',
    'TEST',
    2,
    programId,
  );

  {
    // mock Token.tokenInfo()'s getAccountInfo
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [testToken.token.toBase58()],
      },
      {
        error: null,
        result: {
          owner: [...programId.toBuffer()],
          lamports: 1,
          data: [
            1,
            16,
            39,
            0,
            0,
            0,
            0,
            0,
            0,
            2,
            10,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            84,
            101,
            115,
            116,
            32,
            116,
            111,
            107,
            101,
            110,
            4,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            84,
            69,
            83,
            84,
          ],
          executable: false,
        },
      },
    ]);
  }

  const tokenInfo = await testToken.tokenInfo();

  expect(tokenInfo.supply.toNumber()).toBe(10000);
  expect(tokenInfo.decimals).toBe(2);
  expect(tokenInfo.name).toBe('Test token');
  expect(tokenInfo.symbol).toBe('TEST');

  {
    // mock Token.accountInfo()'s getAccountInfo
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [initialOwnerTokenAccount.toBase58()],
      },
      {
        error: null,
        result: {
          owner: [...programId.toBuffer()],
          lamports: 1,
          data: [
            2,
            ...testToken.token.toBuffer(),
            ...initialOwner.publicKey.toBuffer(),
            16,
            39,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  const accountInfo = await testToken.accountInfo(initialOwnerTokenAccount);

  expect(accountInfo.token.equals(testToken.token)).toBe(true);
  expect(accountInfo.owner.equals(initialOwner.publicKey)).toBe(true);
  expect(accountInfo.amount.toNumber()).toBe(10000);
  expect(accountInfo.source).toBe(null);
  expect(accountInfo.originalAmount.toNumber()).toBe(0);
});

test('create new token account', async () => {
  const connection = new Connection(url);
  // TODO connection._disableBlockhashCaching = mockRpcEnabled;
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }
  if (programId == null){
    console.log('test skipped, requires "load tokeen program" to succeed');
    return;
  }

  const destOwner = await newAccountWithLamports(connection);

  {
    // mock SystemProgram.createAccount transaction for Token.newAccount()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.newAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  const dest = await testToken.newAccount(destOwner);
  {
    // mock Token.accountInfo()'s getAccountInfo
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [dest.toBase58()],
      },
      {
        error: null,
        result: {
          owner: [...programId.toBuffer()],
          lamports: 1,
          data: [
            2,
            ...testToken.token.toBuffer(),
            ...destOwner.publicKey.toBuffer(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  const accountInfo = await testToken.accountInfo(dest);

  expect(accountInfo.token.equals(testToken.token)).toBe(true);
  expect(accountInfo.owner.equals(destOwner.publicKey)).toBe(true);
  expect(accountInfo.amount.toNumber()).toBe(0);
  expect(accountInfo.source).toBe(null);
});

test('transfer', async () => {
  const connection = new Connection(url);
  // TODO connection._disableBlockhashCaching = mockRpcEnabled;
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }
  if (programId == null){
    console.log('test skipped, requires "load tokeen program" to succeed');
    return;
  }

  const destOwner = await newAccountWithLamports(connection);

  {
    // mock SystemProgram.createAccount transaction for Token.newAccount()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.newAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  const dest = await testToken.newAccount(destOwner);

  {
    // mock Token.transfer()'s getAccountInfo
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [initialOwnerTokenAccount.toBase58()],
      },
      {
        error: null,
        result: {
          owner: [...programId.toBuffer()],
          lamports: 1,
          data: [
            2,
            ...testToken.token.toBuffer(),
            ...initialOwner.publicKey.toBuffer(),
            123,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);

    // mock Token.transfer() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  await testToken.transfer(initialOwner, initialOwnerTokenAccount, dest, 123);

  {
    // mock Token.accountInfo()'s getAccountInfo
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [dest.toBase58()],
      },
      {
        error: null,
        result: {
          owner: [...programId.toBuffer()],
          lamports: 1,
          data: [
            2,
            ...testToken.token.toBuffer(),
            ...dest.toBuffer(),
            123,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  await sleep(500);

  const destAccountInfo = await testToken.accountInfo(dest);
  expect(destAccountInfo.amount.toNumber()).toBe(123);
});

test('approve/revoke', async () => {
  const connection = new Connection(url);
  // TODO connection._disableBlockhashCaching = mockRpcEnabled;
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }
  if (programId == null){
    console.log('test skipped, requires "load tokeen program" to succeed');
    return;
  }

  const delegateOwner = await newAccountWithLamports(connection);

  {
    // mock SystemProgram.createAccount transaction for Token.newAccount()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.newAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }
  const delegate = await testToken.newAccount(
    delegateOwner,
    initialOwnerTokenAccount,
  );

  {
    // mock Token.approve() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  await testToken.approve(
    initialOwner,
    initialOwnerTokenAccount,
    delegate,
    456,
  );

  {
    // mock Token.accountInfo()'s getAccountInfo
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [delegate.toBase58()],
      },
      {
        error: null,
        result: {
          owner: [...programId.toBuffer()],
          lamports: 1,
          data: [
            2,
            ...testToken.token.toBuffer(),
            ...delegate.toBuffer(),
            200,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            ...initialOwnerTokenAccount.toBuffer(),
            200,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  let delegateAccountInfo = await testToken.accountInfo(delegate);

  expect(delegateAccountInfo.amount.toNumber()).toBe(456);
  expect(delegateAccountInfo.originalAmount.toNumber()).toBe(456);
  if (delegateAccountInfo.source === null) {
    throw new Error('source should not be null');
  } else {
    expect(delegateAccountInfo.source.equals(initialOwnerTokenAccount)).toBe(
      true,
    );
  }

  {
    // mock Token.revoke() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  await testToken.revoke(initialOwner, initialOwnerTokenAccount, delegate);

  {
    // mock Token.accountInfo()'s getAccountInfo
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [delegate.toBase58()],
      },
      {
        error: null,
        result: {
          owner: [...programId.toBuffer()],
          lamports: 1,
          data: [
            2,
            ...testToken.token.toBuffer(),
            ...delegate.toBuffer(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            ...initialOwnerTokenAccount.toBuffer(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  delegateAccountInfo = await testToken.accountInfo(delegate);
  expect(delegateAccountInfo.amount.toNumber()).toBe(0);
  expect(delegateAccountInfo.originalAmount.toNumber()).toBe(0);
  if (delegateAccountInfo.source === null) {
    throw new Error('source should not be null');
  } else {
    expect(delegateAccountInfo.source.equals(initialOwnerTokenAccount)).toBe(
      true,
    );
  }
});

test('invalid approve', async () => {
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }
  if (programId == null){
    console.log('test skipped, requires "load tokeen program" to succeed');
    return;
  }

  const connection = new Connection(url);
  const owner = await newAccountWithLamports(connection);

  const account1 = await testToken.newAccount(owner);
  const account1Delegate = await testToken.newAccount(owner, account1);
  const account2 = await testToken.newAccount(owner);

  // account2 is not a delegate account of account1
  await expect(
    testToken.approve(owner, account1, account2, 123),
  ).rejects.toThrow();

  // account1Delegate is not a delegate account of account2
  await expect(
    testToken.approve(owner, account2, account1Delegate, 123),
  ).rejects.toThrow();
});

test('fail on approve overspend', async () => {
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }
  if (programId == null){
    console.log('test skipped, requires "load tokeen program" to succeed');
    return;
  }

  const connection = new Connection(url);
  const owner = await newAccountWithLamports(connection);

  const account1 = await testToken.newAccount(owner);
  const account1Delegate = await testToken.newAccount(owner, account1);
  const account2 = await testToken.newAccount(owner);

  await testToken.transfer(
    initialOwner,
    initialOwnerTokenAccount,
    account1,
    10,
  );

  await testToken.approve(owner, account1, account1Delegate, 2);

  let delegateAccountInfo = await testToken.accountInfo(account1Delegate);
  expect(delegateAccountInfo.amount.toNumber()).toBe(2);
  expect(delegateAccountInfo.originalAmount.toNumber()).toBe(2);

  await testToken.transfer(owner, account1Delegate, account2, 1);

  delegateAccountInfo = await testToken.accountInfo(account1Delegate);
  expect(delegateAccountInfo.amount.toNumber()).toBe(1);
  expect(delegateAccountInfo.originalAmount.toNumber()).toBe(2);

  await testToken.transfer(owner, account1Delegate, account2, 1);

  delegateAccountInfo = await testToken.accountInfo(account1Delegate);
  expect(delegateAccountInfo.amount.toNumber()).toBe(0);
  expect(delegateAccountInfo.originalAmount.toNumber()).toBe(2);

  await expect(
    testToken.transfer(owner, account1Delegate, account2, 1),
  ).rejects.toThrow();
});

test('set owner', async () => {
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }
  if (programId == null){
    console.log('test skipped, requires "load tokeen program" to succeed');
    return;
  }

  const connection = new Connection(url);
  const owner = await newAccountWithLamports(connection);
  const newOwner = await newAccountWithLamports(connection);

  const account = await testToken.newAccount(owner);

  await testToken.setOwner(owner, account, newOwner.publicKey);
  await expect(
    testToken.setOwner(owner, account, newOwner.publicKey),
  ).rejects.toThrow();

  await testToken.setOwner(newOwner, account, owner.publicKey);
});
