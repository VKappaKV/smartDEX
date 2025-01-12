import { Contract } from '@algorandfoundation/tealscript';
import { CaelusAdmin } from '../../../../Vestguard/src/CaelusAdmin.algo';

const TOTAL_SUPPLY = 10 ** 16;
const SCALE = 1_000;

export class SmartDex extends Contract {
  default_governor = GlobalStateKey<Address>({ key: 'g' });

  assetA = GlobalStateKey<AssetID>({ key: 'a' });

  assetB = GlobalStateKey<AssetID>({ key: 'b' });

  poolToken = GlobalStateKey<AssetID>({ key: 'p' });

  ratio = GlobalStateKey<uint64>({ key: 'r' });

  fee = GlobalStateKey<uint64>({ key: 'f' });

  highestBidder = GlobalStateKey<Address>({ key: 'h' });

  bidList = GlobalStateKey<StaticArray<Address, 2>>({ key: 'bdL' });

  bidAmount = GlobalStateKey<uint64>({ key: 'bdA' });

  createApplication(): void {
    this.default_governor.value = this.txn.sender;
    this.fee.value = 5;
  }

  bootstrap(seed: PayTxn, aAsset: AssetID, bAsset: AssetID): AssetID {
    verifyAppCallTxn(this.txn, { sender: this.default_governor.value });

    // is it needed ? assert(globals.groupSize === 2);

    verifyPayTxn(seed, { receiver: this.app.address, amount: { greaterThanEqualTo: 300_000 } });
    assert(aAsset < bAsset);

    this.assetA.value = aAsset;
    this.assetB.value = bAsset;
    this.poolToken.value = this.doCreatePoolToken(aAsset, bAsset);

    this.doOptIn(aAsset);
    this.doOptIn(bAsset);

    return this.poolToken.value;
  }

  mintFromAlgo(caelus: AppID, algotxn: PayTxn, assetTxn: AssetTransferTxn): void {
    verifyPayTxn(algotxn, {
      receiver: this.app.address,
    });
    verifyAssetTransferTxn(assetTxn, {
      assetReceiver: this.app.address,
      xferAsset: {
        notIncludedIn: [caelus.globalState('token_id') as AssetID],
        includedIn: [this.assetA.value, this.assetB.value],
      },
    });

    sendMethodCall<typeof CaelusAdmin.prototype.instantMintRequest>({
      applicationID: caelus,
      methodArgs: [
        {
          receiver: caelus.address,
          amount: algotxn.amount,
        },
      ],
    });

    // TODO make mint call here?
  }

  mint(aXfer: AssetTransferTxn, bXfer: AssetTransferTxn, poolAsset: AssetID, aAsset: AssetID, bAsset: AssetID): void {
    /// well formed mint
    assert(aAsset === this.assetA.value);
    assert(bAsset === this.assetB.value);
    assert(poolAsset === this.poolToken.value);

    /// valid asset A axfer
    verifyAssetTransferTxn(aXfer, {
      sender: this.txn.sender,
      assetAmount: { greaterThan: 0 },
      assetReceiver: this.app.address,
      xferAsset: aAsset,
    });

    /// valid asset B axfer
    verifyAssetTransferTxn(bXfer, {
      sender: this.txn.sender,
      assetAmount: { greaterThan: 0 },
      assetReceiver: this.app.address,
      xferAsset: bAsset,
    });

    if (
      this.app.address.assetBalance(aAsset) === aXfer.assetAmount &&
      this.app.address.assetBalance(bAsset) === bXfer.assetAmount
    ) {
      this.tokensToMintIntial(aXfer.assetAmount, bXfer.assetAmount);
    } else {
      const toMint = this.tokensToMint(
        TOTAL_SUPPLY - this.app.address.assetBalance(poolAsset),
        this.app.address.assetBalance(aAsset) - aXfer.assetAmount,
        this.app.address.assetBalance(bAsset) - bXfer.assetAmount,
        aXfer.assetAmount,
        bXfer.assetAmount
      );

      assert(toMint > 0);

      this.doAxfer(this.txn.sender, poolAsset, toMint);
    }
  }

  burn(poolXfer: AssetTransferTxn, poolAsset: AssetID, aAsset: AssetID, bAsset: AssetID): void {
    /// well formed burn
    assert(poolAsset === this.poolToken.value);
    assert(aAsset === this.assetA.value);
    assert(bAsset === this.assetB.value);

    /// valid pool axfer
    verifyAssetTransferTxn(poolXfer, {
      sender: this.txn.sender,
      assetAmount: { greaterThan: 0 },
      assetReceiver: this.app.address,
      xferAsset: poolAsset,
    });

    const issued = TOTAL_SUPPLY - (this.app.address.assetBalance(poolAsset) - poolXfer.assetAmount);

    const aAmt = this.tokensToBurn(issued, this.app.address.assetBalance(aAsset), poolXfer.assetAmount);

    const bAmt = this.tokensToBurn(issued, this.app.address.assetBalance(bAsset), poolXfer.assetAmount);

    this.doAxfer(this.txn.sender, aAsset, aAmt);
    this.doAxfer(this.txn.sender, bAsset, bAmt);

    this.ratio.value = this.computeRatio();
  }

  swap(swapXfer: AssetTransferTxn, aAsset: AssetID, bAsset: AssetID): void {
    /// well formed swap
    assert(aAsset === this.assetA.value);
    assert(bAsset === this.assetB.value);

    verifyAssetTransferTxn(swapXfer, {
      assetAmount: { greaterThan: 0 },
      assetReceiver: this.app.address,
      sender: this.txn.sender,
      xferAsset: { includedIn: [aAsset, bAsset] },
    });

    const outId = swapXfer.xferAsset === aAsset ? aAsset : bAsset;

    const inId = swapXfer.xferAsset;

    const fees = this.feeToCollect(swapXfer.assetAmount);

    const toSwap = this.tokensToSwap(
      swapXfer.assetAmount - fees,
      this.app.address.assetBalance(inId) - swapXfer.assetAmount,
      this.app.address.assetBalance(outId)
    );

    assert(toSwap > 0);

    this.doAxfer(this.txn.sender, outId, toSwap);

    this.doAxfer(this.bidList.value[0], inId, fees);

    this.ratio.value = this.computeRatio();
  }

  becomeBidder(payMBR: PayTxn): void {
    verifyPayTxn(payMBR, {
      receiver: this.app.address,
      amount: { greaterThan: 200_000 },
    });
    // create escrow to bidder account to use to deposit LP tokens and fees accrued
  }

  bid(lpAsset: AssetID, rounds: uint64, bid: uint64, start: uint64): void {
    // check if bid is set correctly;
    // check if the bid for the given starting round is winning;
  }

  changeFee(fee: uint64): void {
    verifyTxn(this.txn, {
      sender: this.highestBidder.value,
    });

    this.fee.value = fee;
  }

  private doCreatePoolToken(aAsset: AssetID, bAsset: AssetID): AssetID {
    return sendAssetCreation({
      configAssetName: 'VLP-' + aAsset.unitName + '-' + bAsset.unitName,
      configAssetUnitName: 'vlp',
      configAssetTotal: TOTAL_SUPPLY,
      configAssetDecimals: 3,
      configAssetManager: this.app.address,
      configAssetReserve: this.app.address,
    });
  }

  private doAxfer(receiver: Address, asset: AssetID, amount: uint64): void {
    sendAssetTransfer({
      assetReceiver: receiver,
      xferAsset: asset,
      assetAmount: amount,
    });
  }

  private doOptIn(asset: AssetID): void {
    this.doAxfer(this.app.address, asset, 0);
  }

  private tokensToMintIntial(aAmount: uint64, bAmount: uint64): uint64 {
    return sqrt(aAmount * bAmount);
  }

  private tokensToMint(issued: uint64, aSupply: uint64, bSupply: uint64, aAmount: uint64, bAmount: uint64): uint64 {
    const aRatio = wideRatio([aAmount, SCALE], [aSupply]);
    const bRatio = wideRatio([bAmount, SCALE], [bSupply]);

    const ratio = aRatio < bRatio ? aRatio : bRatio;

    return wideRatio([ratio, issued], [SCALE]);
  }

  private computeRatio(): uint64 {
    return wideRatio(
      [this.app.address.assetBalance(this.assetA.value), SCALE],
      [this.app.address.assetBalance(this.assetB.value)]
    );
  }

  private tokensToBurn(issued: uint64, supply: uint64, amount: uint64): uint64 {
    return wideRatio([supply, amount], [issued]);
  }

  private tokensToSwap(inAmount: uint64, inSupply: uint64, outSupply: uint64): uint64 {
    const factor = SCALE;
    return wideRatio([inAmount, factor, outSupply], [inSupply * SCALE + inAmount * factor]);
  }

  private feeToCollect(amount: uint64): uint64 {
    return wideRatio([amount, this.fee.value], [SCALE]);
  }
}
