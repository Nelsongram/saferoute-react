import { useState, useEffect } from 'react'
import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import { TransactionStatus } from 'genlayer-js/types'

const CONTRACT = '0xd3a3b52499A1e24A052c9486302DDa8Bacf983B7'

export default function App() {
  const [query, setQuery] = useState('')
  const [wallet, setWallet] = useState(null)
  const [client, setClient] = useState(null)
  const [status, setStatus] = useState('idle') // idle | connecting | processing | done | error
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // Auto connect if already authorized
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts.length > 0) setupClient(accounts[0])
      })
      window.ethereum.on('accountsChanged', accounts => {
        if (accounts.length > 0) setupClient(accounts[0])
        else { setWallet(null); setClient(null) }
      })
    }
  }, [])

  // Elapsed timer
  useEffect(() => {
    let interval
    if (status === 'processing') {
      setElapsed(0)
      interval = setInterval(() => setElapsed(e => e + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [status])

  function setupClient(address) {
    const c = createClient({
      chain: testnetBradbury,
      account: address,
    })
    setWallet(address)
    setClient(c)
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert('Please install MetaMask')
      return
    }
    setStatus('connecting')
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setupClient(accounts[0])
      setStatus('idle')
    } catch(e) {
      setStatus('idle')
    }
  }

  async function checkSafety() {
    if (!query.trim()) return alert('Please enter a route')
    if (!client) { await connectWallet(); return }

    setStatus('processing')
    setResult(null)
    setError('')

    try {
      const txHash = await client.writeContract({
        address: CONTRACT,
        functionName: 'check_safety',
        args: [query.trim()],
        value: 0n,
      })

      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED,
        retries: 60,
        interval: 5000,
      })

      const [rating, situation, alternatives, steps] = await Promise.all([
        client.readContract({ address: CONTRACT, functionName: 'get_rating', args: [] }),
        client.readContract({ address: CONTRACT, functionName: 'get_situation', args: [] }),
        client.readContract({ address: CONTRACT, functionName: 'get_alternatives', args: [] }),
        client.readContract({ address: CONTRACT, functionName: 'get_steps', args: [] }),
      ])

      let stepsArr = []
      try {
        stepsArr = JSON.parse(steps || '[]')
        if (typeof stepsArr === 'string') stepsArr = JSON.parse(stepsArr)
      } catch(e) {}

      const res = { rating, situation, alternatives, steps: stepsArr, query: query.trim() }
      setResult(res)
      setHistory(h => [{ query: query.trim(), rating, time: new Date().toLocaleTimeString() }, ...h].slice(0, 5))
      setStatus('done')

    } catch(e) {
      setError(e.message?.includes('denied') ? 'Transaction cancelled in MetaMask.' : e.message)
      setStatus('error')
    }
  }

  const ratingColor = (r) => {
    if (!r) return 'border-slate-500'
    if (r.includes('Dangerous')) return 'border-red-500 bg-red-950/30'
    if (r.includes('Safe')) return 'border-green-500 bg-green-950/30'
    return 'border-orange-500 bg-orange-950/30'
  }

  return (
    <div style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e2937 100%)', minHeight: '100vh'}} className="text-slate-200 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-blue-400 flex items-center justify-center gap-3">
            🛡️ SafeRoute NG
          </h1>
          <p className="text-slate-400 mt-2">Real-time Nigeria Inter-City Route Safety Intelligence</p>
          <p className="text-slate-500 text-sm mt-1">Powered by GenLayer Bradbury · On-Chain AI Consensus</p>
        </div>

        {/* Input Card */}
        <div className="rounded-2xl p-8 shadow-2xl mb-4" style={{background: 'rgba(30,41,59,0.95)'}}>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkSafety()}
              placeholder="e.g. Lagos to Kaduna, Abuja to Port Harcourt"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-6 py-4 text-lg focus:outline-none focus:border-blue-500 transition"
            />
            <button
              onClick={checkSafety}
              disabled={status === 'processing' || status === 'connecting'}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-8 rounded-xl font-semibold flex items-center gap-2 transition"
            >
              {status === 'processing'
                ? <><i className="fas fa-spinner fa-spin"></i> Processing...</>
                : <><i className="fas fa-shield-alt"></i> Check Safety</>}
            </button>
          </div>

          {/* Wallet Bar */}
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-sm">
              {wallet
                ? <><i className="fas fa-check-circle text-green-400 mr-1"></i> {wallet.slice(0,6)}...{wallet.slice(-4)}</>
                : <><i className="fas fa-wallet mr-1"></i> Not connected</>}
            </p>
            {!wallet && (
              <button onClick={connectWallet} className="text-sm bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition">
                Connect MetaMask
              </button>
            )}
          </div>
        </div>

        {/* Processing */}
        {status === 'processing' && (
          <div className="rounded-2xl p-8 text-center mb-4" style={{background: 'rgba(30,41,59,0.95)'}}>
            <i className="fas fa-spinner fa-3x fa-spin text-blue-400 mb-4"></i>
            <p className="text-xl">Analyzing route on GenLayer Bradbury...</p>
            <p className="text-slate-400 mt-2">AI validators are fetching live security data</p>
            <p className="text-slate-500 text-sm mt-1">⚠️ Takes 60–120 seconds on testnet</p>
            <p className="text-blue-400 font-mono text-lg mt-4">{elapsed}s elapsed</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-2xl p-6 mb-4 border border-red-500/30 bg-red-950/20">
            <i className="fas fa-exclamation-circle text-red-400 mr-2"></i>
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Result */}
        {result && status === 'done' && (
          <div className={`rounded-2xl p-8 border-2 mb-4 ${ratingColor(result.rating)}`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-slate-400 text-sm mb-1">Safety Rating</p>
                <span className="text-3xl font-bold">{result.rating}</span>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Route</p>
                <p className="font-semibold text-blue-300">{result.query}</p>
              </div>
            </div>
            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-400 text-sm font-semibold mb-2">📡 Current Situation</p>
              <p className="text-slate-300 leading-relaxed">{result.situation}</p>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm font-semibold mb-2">🔀 Safer Alternatives</p>
              <p className="text-slate-300">{result.alternatives}</p>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm font-semibold mb-2">✅ Safety Steps</p>
              <ul className="space-y-2 text-slate-300">
                {result.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-400 font-bold">{i+1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-700 flex items-center gap-2 text-slate-500 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
              Finalized on GenLayer Bradbury Testnet
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 text-slate-300">Recent Checks</h3>
            <div className="space-y-3">
              {history.map((item, i) => (
                <div key={i} onClick={() => setQuery(item.query)}
                  className="p-4 rounded-xl cursor-pointer hover:bg-slate-700 transition flex justify-between items-center"
                  style={{background: 'rgba(30,41,59,0.95)'}}>
                  <span className="font-medium">{item.query}</span>
                  <div className="text-right">
                    <span className="text-sm">{item.rating}</span>
                    <span className="text-xs text-slate-500 block">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
