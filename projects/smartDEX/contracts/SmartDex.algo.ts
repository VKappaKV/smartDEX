import { Contract } from '@algorandfoundation/tealscript';

export class SmartDex extends Contract {
  manager = GlobalStateKey<Address>({ key: 'manager' });

  /**
   * Fa da factory contract?
   * Oppure Order tenuti in Box?
   *
   * Factory mechanism:
   *
   * Deploy Order Contract-> Input, Expected Output (Min amount tolerated), Fee.
   */
}
