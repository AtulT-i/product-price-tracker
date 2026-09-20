import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Package,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  BarChart3,
  ShieldCheck,
  Bell,
  Sliders,
  Download,
  Terminal,
  Zap,
  Radio,
  Sparkles,
  ChevronRight,
  MousePointer,
  Cpu,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000';

export default function App() {
  const [tracked, setTracked] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [storeHealth, setStoreHealth] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [notification, setNotification] = useState(null);
  const [showConsole, setShowConsole] = useState(true);
  const [targetInput, setTargetInput] = useState('');

  const showToast = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) setBackendStatus('online');
      else setBackendStatus('offline');
    } catch {
      setBackendStatus('offline');
    }
  };

  const fetchTracked = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracked`);
      if (res.ok) {
        const data = await res.json();
        const list = data.products || [];
        setTracked(list);
        if (!selectedId && list.length > 0) {
          setSelectedId(list[0].product_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tracked:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs?limit=40`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const fetchStoreHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health/store`);
      if (res.ok) {
        const data = await res.json();
        setStoreHealth(data.health);
      }
    } catch (err) {
      console.error('Failed to fetch store health:', err);
    }
  };

  const fetchHistory = async (productId) => {
    if (!productId) return;
    try {
      const res = await fetch(`${API_BASE}/api/history/${productId}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    checkHealth();
    fetchTracked();
    fetchLogs();
    fetchAlerts();
    fetchStoreHealth();
    const interval = setInterval(() => {
      checkHealth();
      fetchTracked();
      fetchLogs();
      fetchAlerts();
      fetchStoreHealth();
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchHistory(selectedId);
      const prod = tracked.find(p => p.product_id === selectedId);
      setTargetInput(prod?.target_price ? String(prod.target_price) : '');
    }
  }, [selectedId, tracked]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE}/api/catalog/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleTrack = async (product) => {
    try {
      const res = await fetch(`${API_BASE}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      if (res.ok) {
        showToast(`"${product.name}" added to watch queue. Initial scrape active!`, 'success');
        setSearchQuery('');
        setSearchResults([]);
        setSelectedId(product.id);
        fetchTracked();
        setTimeout(fetchTracked, 5000);
      }
    } catch {
      showToast('Failed to track product', 'error');
    }
  };

  const handleUntrack = async (productId) => {
    if (!confirm('Remove this product from tracking?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/track/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Target removed from watch queue', 'info');
        const nextList = tracked.filter(p => p.product_id !== productId);
        setTracked(nextList);
        if (selectedId === productId) {
          setSelectedId(nextList.length > 0 ? nextList[0].product_id : null);
        }
      }
    } catch {
      showToast('Failed to remove product', 'error');
    }
  };

  const handleSaveSettings = async (frequency, targetPrice) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`${API_BASE}/api/track/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency, targetPrice: targetPrice ? Number(targetPrice) : null })
      });
      if (res.ok) {
        showToast('Target parameters updated!', 'success');
        fetchTracked();
      }
    } catch {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleScrapeAll = async () => {
    setIsScrapingAll(true);
    showToast('Scheduled scrape pipeline dispatched for all targets...', 'info');
    try {
      await fetch(`${API_BASE}/api/scrape-now`, { method: 'POST' });
      setTimeout(() => {
        setIsScrapingAll(false);
        fetchTracked();
        fetchLogs();
        fetchAlerts();
      }, 5000);
    } catch {
      setIsScrapingAll(false);
      showToast('Pipeline execution failed', 'error');
    }
  };

  const activeProduct = useMemo(() => {
    return tracked.find(p => p.product_id === selectedId) || null;
  }, [tracked, selectedId]);

  const priceStats = useMemo(() => {
    if (!historyData.length) return { min: 0, max: 0, current: activeProduct?.last_price || 0 };
    const prices = historyData.map(h => Number(h.price)).filter(Boolean);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      current: activeProduct?.last_price || prices[prices.length - 1]
    };
  }, [historyData, activeProduct]);

  const formatINR = (val) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh', overflow: 'hidden', backgroundColor: '#07090e', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'success' ? '#10b981' : '#38bdf8',
          color: notification.type === 'info' ? '#07090e' : '#fff',
          padding: '10px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700,
          fontSize: '13px',
          backdropFilter: 'blur(8px)'
        }}>
          <Sparkles size={16} />
          {notification.msg}
        </div>
      )}

      {/* Top Studio Navbar */}
      <header style={{
        height: '56px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        backgroundColor: '#0b0f17',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
          }}>
            <Layers size={18} color="#07090e" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px', color: '#f8fafc' }}>
              OmniTrack
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>/</span>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              INE Hostile Scraper Studio
            </span>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: storeHealth?.drift_detected ? '#f59e0b' : '#34d399'
          }}>
            <Radio size={12} className="animate-pulse" />
            <span>REV {storeHealth?.last_revision || '627002'} : {storeHealth?.status || 'STABLE'}</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            fontSize: '11px',
            fontWeight: 600,
            color: backendStatus === 'online' ? '#34d399' : '#f87171'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: backendStatus === 'online' ? '#34d399' : '#f87171'
            }} className={backendStatus === 'online' ? 'animate-pulse' : ''} />
            {backendStatus === 'online' ? 'DAEMON READY' : 'OFFLINE'}
          </div>

          <button
            onClick={handleScrapeAll}
            disabled={isScrapingAll || backendStatus !== 'online'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: isScrapingAll ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              opacity: isScrapingAll ? 0.7 : 1,
              transition: 'background 0.15s'
            }}
          >
            <RefreshCw size={13} className={isScrapingAll ? 'animate-spin' : ''} />
            {isScrapingAll ? 'Running...' : 'Scrape All'}
          </button>
        </div>
      </header>

      {/* Main Split-View Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT PANEL: Monitored Assets Watchlist (380px) */}
        <div style={{
          width: '380px',
          minWidth: '340px',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#090d14'
        }}>
          {/* Search Omnibox */}
          <div style={{ padding: '14px', borderBottom: '1px solid #1e293b', position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#111827',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '8px 12px',
              gap: '10px'
            }}>
              <Search size={16} color="#64748b" />
              <input
                type="text"
                placeholder="Search 1,000 INE items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '13px'
                }}
              />
              {isSearching && <RefreshCw size={14} className="animate-spin" color="#38bdf8" />}
            </div>

            {/* Dropdown Results */}
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '14px',
                right: '14px',
                zIndex: 100,
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: '0 20px 30px rgba(0,0,0,0.8)'
              }}>
                {searchResults.map((item) => {
                  const isTracked = tracked.some(p => p.product_id === item.id);
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #1e293b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ maxWidth: '200px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {item.brand} · {item.category}
                        </div>
                      </div>
                      <button
                        onClick={() => handleTrack(item)}
                        disabled={isTracked}
                        style={{
                          backgroundColor: isTracked ? '#1e293b' : '#0284c7',
                          color: isTracked ? '#64748b' : '#fff',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: isTracked ? 'default' : 'pointer'
                        }}
                      >
                        {isTracked ? 'Tracked' : '+ Track'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Watchlist Header */}
          <div style={{
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#64748b',
            letterSpacing: '0.5px',
            borderBottom: '1px solid #1e293b'
          }}>
            <span>Watchlist ({tracked.length})</span>
            <span>Price / Stock</span>
          </div>

          {/* Watchlist Items */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tracked.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No tracked products. Use the search bar above to monitor an item.
              </div>
            ) : (
              tracked.map((product) => {
                const isSelected = product.product_id === selectedId;
                return (
                  <div
                    key={product.product_id}
                    onClick={() => setSelectedId(product.product_id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #1e293b',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#131d2e' : 'transparent',
                      borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
                      transition: 'background 0.1s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ maxWidth: '190px' }}>
                      <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                        {product.category}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        SKU: {product.sku || 'N/A'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                        {formatINR(product.last_price)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: product.in_stock ? '#34d399' : '#f87171',
                          backgroundColor: product.in_stock ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          {product.in_stock ? `${product.last_stock ?? 0} in stock` : 'Out'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Selected Target Deep-Dive */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0b0f17', overflowY: 'auto' }}>
          {activeProduct ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Product Hero Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingBottom: '16px',
                borderBottom: '1px solid #1e293b'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#38bdf8',
                      textTransform: 'uppercase',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(56, 189, 248, 0.3)'
                    }}>
                      {activeProduct.category}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Target #{activeProduct.product_id} · {activeProduct.brand}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    {activeProduct.name}
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <a
                    href={`${API_BASE}/api/export/csv/${activeProduct.product_id}`}
                    download
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#111827',
                      color: '#94a3b8',
                      border: '1px solid #1e293b',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    <Download size={13} /> Export CSV
                  </a>
                  <a
                    href={`https://demo.inelabteamdev.com/product/${activeProduct.product_id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#111827',
                      color: '#94a3b8',
                      border: '1px solid #1e293b',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={13} /> Store View
                  </a>
                  <button
                    onClick={() => handleUntrack(activeProduct.product_id)}
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    Untrack
                  </button>
                </div>
              </div>

              {/* Price & Telemetry Stat Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px'
              }}>
                <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>CURRENT PRICE</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginTop: '4px', fontFamily: 'monospace' }}>
                    {formatINR(activeProduct.last_price)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#34d399', marginTop: '2px' }}>
                    {activeProduct.in_stock ? 'In Stock' : 'Out of Stock'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>ALL-TIME LOW</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '4px', fontFamily: 'monospace' }}>
                    {formatINR(priceStats.min)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Historical benchmark</div>
                </div>

                <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>ALL-TIME HIGH</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#f43f5e', marginTop: '4px', fontFamily: 'monospace' }}>
                    {formatINR(priceStats.max)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Peak observed price</div>
                </div>

                <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>CURRENT INVENTORY</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', marginTop: '4px', fontFamily: 'monospace' }}>
                    {activeProduct.last_stock ?? '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Available units</div>
                </div>
              </div>

              {/* Price Trend Chart Section */}
              <div style={{
                backgroundColor: '#111827',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      Price Trajectory Curve
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      Continuously scraped snapshots plotted against timestamp
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace' }}>
                    {historyData.length} Snapshots
                  </span>
                </div>

                {historyData.length > 1 ? (
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData.map(h => ({
                        time: new Date(h.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        price: Number(h.price)
                      }))}>
                        <defs>
                          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(val) => [`₹${val}`, 'Price']}
                        />
                        <Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#priceGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '13px', backgroundColor: '#0b0f17', borderRadius: '8px' }}>
                    Initial price captured ({formatINR(activeProduct.last_price)}). Trend curve activates on subsequent 2-hour scrapes.
                  </div>
                )}
              </div>

              {/* Scrape Controls & Alert Thresholds */}
              <div style={{
                backgroundColor: '#111827',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                    Target Alert Threshold & Frequency
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Receive notification if price drops to or below target
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    placeholder="Alert Price (₹)"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    style={{
                      backgroundColor: '#0b0f17',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      width: '140px'
                    }}
                  />
                  <button
                    onClick={() => handleSaveSettings(activeProduct.frequency, targetInput)}
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Save Target
                  </button>
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                    {['15m', '2h', '6h'].map((f) => (
                      <button
                        key={f}
                        onClick={() => handleSaveSettings(f, activeProduct.target_price)}
                        style={{
                          backgroundColor: activeProduct.frequency === f ? '#38bdf8' : '#0b0f17',
                          color: activeProduct.frequency === f ? '#07090e' : '#94a3b8',
                          border: '1px solid #334155',
                          padding: '5px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Select a product from the left watchlist to inspect live telemetry.
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM CONSOLE: Live Scraper Terminal & Execution Log (Collapsible) */}
      <div style={{
        height: showConsole ? '180px' : '36px',
        borderTop: '1px solid #1e293b',
        backgroundColor: '#06080d',
        display: 'flex',
        flexDirection: 'column',
        transition: 'height 0.2s',
        flexShrink: 0
      }}>
        <div style={{
          height: '36px',
          padding: '0 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0b0f17',
          borderBottom: showConsole ? '1px solid #1e293b' : 'none',
          fontSize: '12px',
          cursor: 'pointer'
        }} onClick={() => setShowConsole(!showConsole)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={14} color="#38bdf8" />
            <span style={{ fontWeight: 700, color: '#f1f5f9' }}>SCRAPER EXECUTION TERMINAL</span>
            <span style={{ color: '#64748b', fontSize: '11px' }}>({logs.length} events recorded)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '11px' }}>
            <span>{showConsole ? '▼ Collapse' : '▲ Expand'}</span>
          </div>
        </div>

        {showConsole && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
            {logs.length === 0 ? (
              <div style={{ color: '#64748b' }}>Awaiting scrape daemon events...</div>
            ) : (
              logs.map((log) => {
                const isSuccess = log.status === 'success';
                const isRetried = log.status === 'retried';
                return (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '2px 0', color: isSuccess ? '#94a3b8' : isRetried ? '#f59e0b' : '#f87171' }}>
                    <span style={{ color: '#475569' }}>[{new Date(log.created_at).toLocaleTimeString()}]</span>
                    <span style={{ fontWeight: 700, color: isSuccess ? '#34d399' : isRetried ? '#f59e0b' : '#f87171' }}>
                      {log.status.toUpperCase()}
                    </span>
                    <span style={{ color: '#cbd5e1' }}>{log.product_name || `Target #${log.product_id}`}</span>
                    <span style={{ color: '#64748b' }}>({log.duration_ms}ms, attempt {log.attempts}/3)</span>
                    <span style={{ color: '#38bdf8' }}>{formatINR(log.price_found)}</span>
                    <span style={{ color: '#475569' }}>- {log.error_message || 'Dwell unlocked & verified'}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
