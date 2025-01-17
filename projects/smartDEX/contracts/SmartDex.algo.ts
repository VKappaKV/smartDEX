import { Contract } from '@algorandfoundation/tealscript';
import { PuppetAddress } from './puppetAddress.algo';

type Intent = {
  reserve: Address;
  inID: AssetID;
  outID: AssetID;
  rule: uint64;
};

export class SmartDex extends Contract {
  manager = GlobalStateKey<Address>({ key: 'manager' });

  intentRegistry = BoxMap<Address, Intent>({ prefix: 'intent_registry' });

  // order/dca////oracle (specific use case to be defined)

  createApplication(): void {
    this.manager.value = this.app.creator;
  }

  bootstrapIntent(inID: AssetID, outID: AssetID, rule: uint64, payMBR: PayTxn): void {
    verifyPayTxn(payMBR, { receiver: this.app.address, amount: { greaterThanEqualTo: 300_000 } });
    this.intentRegistry(this.txn.sender).value = { reserve: this.deployReserve(), inID, outID, rule };
  }

  rolloutIntent(): void {}

  closeIntent(): void {}

  fillIntentOrder(): void {}

  bidForIntent(): void {}

  private deployReserve(): Address {
    return sendMethodCall<typeof PuppetAddress.prototype.new>({
      onCompletion: OnCompletion.DeleteApplication,
      approvalProgram: PuppetAddress.approvalProgram(),
      clearStateProgram: PuppetAddress.clearProgram(),
    });
  }

  /**
   * Fa da factory contract?
   * Oppure Order tenuti in Box?
   *
   * Factory mechanism:
   *
   * Deploy Order Contract-> Input, Expected Output (Min amount tolerated), Fee.
   */
}
