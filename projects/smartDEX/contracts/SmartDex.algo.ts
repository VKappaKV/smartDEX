import { Contract } from '@algorandfoundation/tealscript';
import { PuppetAddress } from './puppetAddress.algo';

export class SmartDex extends Contract {
  manager = GlobalStateKey<Address>({ key: 'manager' });

  programs = GlobalStateMap<bytes, bytes>({ maxKeys: 3, prefix: 'p' }); // order/dca/oracle

  createApplication(): void {
    this.manager.value = this.app.creator;
  }

  deployIntent(type: uint64, inID: AssetID, outID: AssetID, rule: uint64): void {}

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

export class IntentOrder extends Contract {}
