'use client'
import { useEffect, useState } from 'react'
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { WagmiProvider, useAccount, useBalance, useReadContract, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt, useWatchContractEvent, useWriteContract } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isAddress, parseEther } from 'viem'
import { config, FUJI_CHAIN_ID } from './wagmi'
import { ABI, CONTRACT_ADDRESS, OWNER_ADDRESS } from './abi'
import './App.css'

const queryClient = new QueryClient()

function AppContent() {
  const { address, chain, isConnected } = useAccount()
  const [amount, setAmount] = useState('0.01')
  const [recipientAddress, setRecipientAddress] = useState(CONTRACT_ADDRESS)
  const [sendAmount, setSendAmount] = useState('0.001')
  const [status, setStatus] = useState('Connect your wallet to fund, send, or manage the vault.')
  const [donorCount, setDonorCount] = useState(0)
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>(undefined)

  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address: CONTRACT_ADDRESS as `0x${string}`,
    chainId: FUJI_CHAIN_ID,
  })

  const { data: contractOwner } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: ABI,
    functionName: 'owner',
    chainId: FUJI_CHAIN_ID,
  })

  const { data: donorsCountData, refetch: refetchDonorsCount } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: ABI,
    functionName: 'getDonorsCount',
    chainId: FUJI_CHAIN_ID,
  })

  useWatchContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: ABI,
    eventName: 'Funded',
    chainId: FUJI_CHAIN_ID,
    onLogs: async () => {
      const refreshed = await refetchDonorsCount()
      if (refreshed.data) {
        setDonorCount(Number(refreshed.data))
      }
    },
  })

  const { writeContractAsync: writeFund, isPending: isFunding } = useWriteContract()
  const { writeContractAsync: writeWithdraw, isPending: isWithdrawing } = useWriteContract()
  const { sendTransactionAsync: sendTransaction, isPending: isSending } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const { data: transactionReceipt, isSuccess: isTransactionConfirmed } = useWaitForTransactionReceipt({
    hash: pendingHash,
    chainId: FUJI_CHAIN_ID,
    query: {
      enabled: Boolean(pendingHash),
    },
  })
  const isOnFuji = chain?.id === FUJI_CHAIN_ID

  useEffect(() => {
    if (donorsCountData) {
      setDonorCount(Number(donorsCountData))
    }
  }, [donorsCountData])

  useEffect(() => {
    if (!pendingHash) {
      return
    }

    if (transactionReceipt?.status === 'success') {
      void Promise.all([refetchBalance(), refetchDonorsCount()]).finally(() => {
        setStatus('Donation confirmed. Donor count and vault balance updated.')
        setPendingHash(undefined)
      })
    }

    if (transactionReceipt?.status === 'reverted') {
      setStatus('Transaction reverted on-chain. Please try again.')
      setPendingHash(undefined)
    }
  }, [pendingHash, transactionReceipt, refetchBalance, refetchDonorsCount])

  const handleSwitchToFuji = async () => {
    try {
      if (!isConnected || !address) {
        setStatus('Please connect your wallet first.')
        return
      }

      await switchChainAsync?.({ chainId: FUJI_CHAIN_ID })
      setStatus('Wallet switched to Avalanche Fuji. You can now send transactions.')
    } catch (error) {
      setStatus(`Unable to switch networks automatically. Please switch your wallet to Avalanche Fuji manually. ${error instanceof Error ? error.message : ''}`)
    }
  }

  const handleFund = async () => {
    try {
      if (!isConnected || !address) {
        setStatus('Please connect your wallet first.')
        return
      }
      if (!isOnFuji) {
        setStatus('Switch your wallet to Avalanche Fuji before funding the vault.')
        return
      }
      const value = parseEther(amount)
      const hash = await writeFund({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'fund',
        value,
        chainId: FUJI_CHAIN_ID,
      })
      setPendingHash(hash)
      setStatus(`Donation of ${amount} AVAX submitted! Waiting for confirmation...`)
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Transaction failed'}`)
    }
  }

  const handleWithdraw = async () => {
    try {
      if (!isConnected || !address) {
        setStatus('Please connect your wallet first.')
        return
      }
      if (!isOnFuji) {
        setStatus('Switch your wallet to Avalanche Fuji before withdrawing funds.')
        return
      }
      const hash = await writeWithdraw({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'withdraw',
        chainId: FUJI_CHAIN_ID,
      })
      setPendingHash(hash)
      setStatus('Withdrawal submitted! Waiting for confirmation...')
    } catch (error) {
      setStatus(`Withdrawal failed: Only the owner can withdraw. ${error instanceof Error ? error.message : ''}`)
    }
  }

  const handleSendTransaction = async () => {
    try {
      if (!isConnected || !address) {
        setStatus('Please connect your wallet first.')
        return
      }
      if (!isOnFuji) {
        setStatus('Switch your wallet to Avalanche Fuji before sending funds.')
        return
      }
      if (!isAddress(recipientAddress)) {
        setStatus('Please enter a valid recipient address.')
        return
      }

      await sendTransaction({
        to: recipientAddress as `0x${string}`,
        value: parseEther(sendAmount),
        chainId: FUJI_CHAIN_ID,
      })
      setStatus(`Transaction submitted to ${recipientAddress.slice(0, 10)}...`)
    } catch (error) {
      setStatus(`Send failed: ${error instanceof Error ? error.message : 'Transaction failed'}`)
    }
  }

  const balance = balanceData?.formatted ?? '0'
  const ownerLabel = contractOwner ? `${String(contractOwner).slice(0, 10)}...` : 'loading'
  const connectedWallet = address ? `${address.slice(0, 10)}...${address.slice(-8)}` : 'Not connected'

  return (
    <div className="page-shell">
      <div className="hero-card">
        <div className="hero-badge">Rainbow Wallet • Donation Vault</div>
        <h1>Support the community with a beautifully connected donation experience.</h1>
        <p>
          Fund the vault, track the balance, and manage withdrawals from a sleek wallet-first interface.
        </p>
        <div className="wallet-row">
          <ConnectButton />
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card glow">
          <span>Vault Balance</span>
          <strong>{Number(balance).toFixed(4)} AVAX</strong>
        </div>
        <div className="stat-card">
          <span>Donors</span>
          <strong>{donorCount}</strong>
        </div>
        <div className="stat-card">
          <span>Owner</span>
          <strong>{ownerLabel}</strong>
        </div>
      </div>

      <div className="panel-grid">
        <section className="panel">
          <h2>Fund the vault</h2>
          <label htmlFor="amount">Amount in AVAX</label>
          <input
            id="amount"
            type="number"
            min="0.001"
            step="0.001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button onClick={handleFund} disabled={isFunding || !isConnected || !isOnFuji}>
            {isFunding ? 'Processing...' : 'Donate now'}
          </button>
          <p className="muted">Connected: {connectedWallet}</p>
          <div className="info-block">
            <p><strong>Network</strong></p>
            <p>{isConnected ? (isOnFuji ? 'Avalanche Fuji is active.' : 'Switch to Avalanche Fuji to send transactions.') : 'Connect your wallet to continue.'}</p>
            {isConnected && !isOnFuji && (
              <button className="secondary" onClick={handleSwitchToFuji}>
                Switch to Fuji
              </button>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Send AVAX to a recipient</h2>
          <label htmlFor="recipient">Recipient address</label>
          <input
            id="recipient"
            type="text"
            value={recipientAddress}
            onChange={(event) => setRecipientAddress(event.target.value)}
            placeholder="0x..."
          />
          <label htmlFor="sendAmount">Amount in AVAX</label>
          <input
            id="sendAmount"
            type="number"
            min="0.001"
            step="0.001"
            value={sendAmount}
            onChange={(event) => setSendAmount(event.target.value)}
          />
          <button onClick={handleSendTransaction} disabled={isSending || !isConnected || !isOnFuji}>
            {isSending ? 'Sending...' : 'Send AVAX'}
          </button>
          <p className="muted">Use this to send AVAX directly to any address on Avalanche Fuji.</p>
        </section>

        <section className="panel">
          <h2>Vault actions</h2>
          <button className="secondary" onClick={handleWithdraw} disabled={isWithdrawing || !isConnected || !isOnFuji}>
            {isWithdrawing ? 'Processing...' : 'Withdraw funds'}
          </button>
          <div className="info-block">
            <p><strong>Status</strong></p>
            <p>{status}</p>
          </div>
          <div className="info-block">
            <p><strong>Contract</strong></p>
            <p>{CONTRACT_ADDRESS}</p>
          </div>
          <div className="info-block">
            <p><strong>Owner wallet</strong></p>
            <p>{OWNER_ADDRESS}</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
