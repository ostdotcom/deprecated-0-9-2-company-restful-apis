const rootPrefix = '..',
  logger = require(rootPrefix + '/providers/logger'),
  manifest = require(rootPrefix + '/manifest');

let txuPrefix = 'create-6880-42e2-9ae1-6bbb2cb5b6a4-' + Date.now();

let buffer = {
  tt: { N: '1' },
  tu: { S: '26e270c1-8cc8-4997-812a-7c4a8891df85' },
  caiw: { N: '9713263332294277' },
  txh: { S: '0x8af22667c49af17f1cb23999515704cdb9f0a746edd1a48eba841c75d41c5b03' },
  ci: { N: '1018' },
  ai: { N: '20088' },
  gp: { N: '5000000000' },
  bn: { N: '1168726' },
  ua: { N: '1524147164000' },
  aiw: { N: '971326333229427764' },
  gu: { N: '105208' },
  fu: { S: 'd11f5169-0902-4857-80c8-f3ea5cd729b3' },
  te: {
    L: [
      {
        M: {
          tu: { S: 'd11f5169-0902-4857-80c8-f3ea5cd729b3' },
          fa: { S: '0xb9f6d4c885e8653f66fbf4f1a87d2db0835c70e8' },
          ta: { S: '0x92f97ae97b22cf971de29ead495231a898a158bd' },
          aiw: { N: '981039596561722041' },
          fu: { S: 'b90555fa-46ce-4e7d-a917-3ab5632a5ce5' }
        }
      },
      {
        M: {
          tu: { S: '26e270c1-8cc8-4997-812a-7c4a8891df85' },
          fa: { S: '0x92f97ae97b22cf971de29ead495231a898a158bd' },
          ta: { S: '0x53dd4f876e922877ba57921ee2f8200bc4ce9963' },
          aiw: { N: '971326333229427764' },
          fu: { S: 'd11f5169-0902-4857-80c8-f3ea5cd729b3' }
        }
      },
      {
        M: {
          tu: { S: '7086a62c-435a-4ee2-9899-725c3b137a92' },
          fa: { S: '0x92f97ae97b22cf971de29ead495231a898a158bd' },
          ta: { S: '0xdcb2ec51c8c4632ae0039befef861fd1de2cd616' },
          aiw: { N: '9713263332294277' },
          fu: { S: 'd11f5169-0902-4857-80c8-f3ea5cd729b3' }
        }
      }
    ]
  },
  s: { N: '2' },
  cti: { N: '30018' },
  ca: { N: '1524147160000' },
  ts: { S: 'SKt' }
};

let dataToInsert = [],
  currentTimestamp = Date.now();

for (let i = 0; i < 10; i++) {
  buffer = JSON.parse(JSON.stringify(buffer));
  buffer['txu'] = { S: `${txuPrefix} ${i + currentTimestamp}` };
  dataToInsert.push(buffer);
}

manifest.services.transactionLog
  .bulk('INSERT', dataToInsert)
  .then(function(response) {
    logger.debug('response', response.toHash());
  })
  .catch(function(reason) {
    logger.error('reason', reason);
  });
