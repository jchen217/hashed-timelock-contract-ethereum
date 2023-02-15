const {assertEqualBN} = require('./helper/assert')
const {
  bufToStr,
  htlcERC20ArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  txContractId,
  txLoggedArgs,
} = require('./helper/utils')

const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const AliceERC20 = artifacts.require('./helper/AliceERC20.sol')

const REQUIRE_FAILED_MSG = 'Returned error: VM Exception while processing transaction: revert'

// some testing data
const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds
const tokenAmount = 5

contract('HashedTimelockERC20', accounts => {
  const sender = accounts[1]
  const receiver = accounts[2]
  const tokenSupply = 1000
  const senderInitialBalance = 100

  let htlc
  let token

  const assertTokenBal = async (addr, tokenAmount, msg) =>
    assertEqualBN(
      await token.balanceOf.call(addr),
      tokenAmount,
      msg ? msg : 'wrong token balance'
    )

  before(async () => {
    htlc = await HashedTimelockERC20.new()
    token = await AliceERC20.new(tokenSupply)
    await token.transfer(sender, senderInitialBalance)
    await assertTokenBal(
      sender,
      senderInitialBalance,
      'balance not transferred in before()'
    )
  })

    it('withdraw() should send receiver funds when given the correct secret preimage', async () => {
    const hashPair = newSecretHashPair()
    const newContractTx = await newContract({hashlock: hashPair.hash})
    const contractId = txContractId(newContractTx)

    // receiver calls withdraw with the secret to claim the tokens
    await htlc.withdraw(contractId, hashPair.secret, {
      from: receiver,
    })

    // Check tokens now owned by the receiver
    await assertTokenBal(
      receiver,
      tokenAmount,
      `receiver doesn't own ${tokenAmount} tokens`
    )

    const contractArr = await htlc.getContract.call(contractId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    assert.equal(contract.preimage, hashPair.secret)
  })

  // Remove skip if using timelock guard (currently commented out)
  /*
  it.skip('refund() should pass after timelock expiry', async () => {
    const hashPair = newSecretHashPair()
    const curBlock = await web3.eth.getBlock('latest')
    const timelock2Seconds = curBlock.timestamp + 2

    await token.approve(htlc.address, tokenAmount, {from: sender})
    const newContractTx = await newContract({
      timelock: timelock2Seconds,
      hashlock: hashPair.hash,
    })
    const contractId = txContractId(newContractTx)

    // wait one second so we move past the timelock time
    return new Promise((resolve, reject) =>
      setTimeout(async () => {
        // attempt to get the refund now we've moved past the timelock time
        const balBefore = await token.balanceOf(sender)
        await htlc.refund(contractId, {from: sender})

        // Check tokens returned to the sender
        await assertTokenBal(
          sender,
          balBefore.add(web3.utils.toBN(tokenAmount)),
          `sender balance unexpected`
        )

        const contractArr = await htlc.getContract.call(contractId)
        const contract = htlcERC20ArrayToObj(contractArr)
        assert.isTrue(contract.refunded)
        assert.isFalse(contract.withdrawn)
      }, 2000)
    )
  })
*/
  // Remove skip if using timelock guard (currently commented out)
  
  /*
   * Helper for newContract() calls, does the ERC20 approve before calling
   */
  const newContract = async ({
                               timelock = timeLock1Hour,
                               hashlock = newSecretHashPair().hash,
                             } = {}) => {
    await token.approve(htlc.address, tokenAmount, {from: sender})
    //await token.transfer(htlc.address, tokenAmount, {from: sender}) //Change to transfer
    return htlc.newContract(
      receiver,
      hashlock,
      timelock,
      token.address,
      tokenAmount,
      {
        from: sender,
      }
    )
  }
  
})
