import { Contract } from '@algorandfoundation/tealscript';

export class SmartDex extends Contract {
  manager = GlobalStateKey<Address>({ key: 'manager' });

  programs = GlobalStateMap<bytes, bytes>({ maxKeys: 3, prefix: 'p' }); // order/dca/oracle

  createApplication(): void {}

  deployIntent(): void {}

  /**
   * Fa da factory contract?
   * Oppure Order tenuti in Box?
   *
   * Factory mechanism:
   *
   * Deploy Order Contract-> Input, Expected Output (Min amount tolerated), Fee.
   */
}

export class OrderIntent extends Contract {}
