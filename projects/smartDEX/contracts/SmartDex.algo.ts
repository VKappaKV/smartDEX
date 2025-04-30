import { Contract } from '@algorandfoundation/tealscript';
import { PuppetAddress } from './puppetAddress.algo';

interface OrderIntent {
  creator: Address;
  reserve: Address;
  inID: AssetID;
  outID: AssetID;
  output: uint64;
  decayRate: uint64;
  filled: boolean;
}

const BOX_MBR = 35_000;

export class SmartDex extends Contract {
  manager = GlobalStateKey<Address>({ key: 'manager' });

  id = GlobalStateKey<uint64>({ key: 'id' });

  orderRegistry = BoxMap<uint64, OrderIntent>({ prefix: 'order_registry' });

  orderAuction = BoxMap<uint64, uint64>({ prefix: 'order_auction' }); // key: intentID, value: block number when auction started

  createApplication(): void {
    this.manager.value = this.app.creator;
    this.id.value = 0;
  }

  updateApplication(): void {
    assert(this.txn.sender === this.manager.value, 'Only manager can update the app');
  }

  bootstrapIntent(inID: AssetID, outID: AssetID, output: uint64, decayRate: uint64, payMBR: PayTxn): uint64 {
    verifyPayTxn(payMBR, { receiver: this.app.address, amount: { greaterThanEqualTo: 400_000 + BOX_MBR } });
    const reserve = this.deployReserve();
    const intent: OrderIntent = {
      creator: this.txn.sender,
      reserve: reserve,
      inID: inID,
      outID: outID,
      output: output,
      decayRate: decayRate,
      filled: false,
    };
    if (inID !== AssetID.fromUint64(0)) {
      sendAssetTransfer({
        assetSender: reserve,
        assetReceiver: reserve,
        xferAsset: inID,
        assetAmount: 0,
      });
    }
    if (outID !== AssetID.fromUint64(0)) {
      sendAssetTransfer({
        assetSender: reserve,
        assetReceiver: reserve,
        xferAsset: outID,
        assetAmount: 0,
      });
    }
    this.id.value += 1;
    this.orderRegistry(this.id.value).value = intent;
    return this.id.value;
  }

  // insert the intent amount for the expected result
  rolloutIntent(input: Txn, id: uint64): void {
    const intent = this.orderRegistry(id).value;

    verifyTxn(input, {
      typeEnum: { includedIn: [TransactionType.AssetTransfer, TransactionType.Payment] },
      sender: intent.creator,
      receiver: intent.reserve,
      amount: { greaterThanEqualTo: 0 },
    });

    if (input.typeEnum === TransactionType.AssetTransfer) {
      assert(input.xferAsset === intent.inID, 'Invalid asset ID');
    }
    this.orderAuction(id).value = globals.round;
  }

  // used if user wants to close his intent
  closeIntent(id: uint64): void {
    const intent = this.orderRegistry(id).value;

    assert(this.txn.sender === intent.creator, 'Only creator can close the intent');
    if (intent.inID !== AssetID.fromUint64(0)) {
      sendAssetTransfer({
        assetSender: intent.reserve,
        assetReceiver: intent.creator,
        xferAsset: intent.inID,
        assetAmount: intent.reserve.assetBalance(intent.inID),
        assetCloseTo: intent.creator,
      });
    }
    if (intent.outID !== AssetID.fromUint64(0)) {
      sendAssetTransfer({
        assetSender: intent.reserve,
        assetReceiver: intent.creator,
        xferAsset: intent.outID,
        assetAmount: intent.reserve.assetBalance(intent.outID),
        assetCloseTo: intent.creator,
      });
    }
    sendPayment({
      sender: intent.reserve,
      receiver: intent.creator,
      amount: intent.reserve.balance,
      closeRemainderTo: intent.creator,
    });
    this.orderRegistry(id).delete();
    this.orderAuction(id).delete();
  }

  // used by solver to fill entirely an intent
  fillIntentOrder(id: uint64, fillTxn: Txn): void {
    assert(this.orderRegistry(id).value.filled === false, 'Intent already filled');
    verifyTxn(fillTxn, {
      typeEnum: { includedIn: [TransactionType.AssetTransfer, TransactionType.Payment] },
      receiver: this.orderRegistry(id).value.reserve,
      amount: { greaterThanEqualTo: this.intentOutputFromDutchAuction(id) },
    });
    this.orderRegistry(id).value.filled = true;
    this.orderAuction(id).delete();
  }

  // used by watcher to check intent price status in the reverse auction
  intentOutputFromDutchAuction(id: uint64): uint64 {
    const intent = this.orderRegistry(id).value;
    let decay = (globals.round - this.orderAuction(id).value) * intent.decayRate;
    decay = wideRatio([decay], [100]);
    return intent.output * decay;
  }

  private deployReserve(): Address {
    return sendMethodCall<typeof PuppetAddress.prototype.new>({
      onCompletion: OnCompletion.DeleteApplication,
      approvalProgram: PuppetAddress.approvalProgram(),
      clearStateProgram: PuppetAddress.clearProgram(),
    });
  }
}
