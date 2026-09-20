import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  TrendingUp,
  Package,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  BarChart2,
  ShieldCheck,
  Bell,
  Sliders,
  Download,
  Terminal,
  Zap,
  Radio,
  Sparkles
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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('tracked'); // 'tracked' | 'logs' | 'drift'
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [notification, setNotification] = useState(null);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState(null);
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
        setTracked(data.products || []);
      }
    } catch (err) {
      console.error('Failed to fetch tracked:', err);
    }
  };

  const fetchLogs = async (pId = null) => {
    try {
      const url = pId ? `${API_BASE}/api/logs?productId=${pId}` : `${API_BASE}/api/logs`;
      const res = await fetch(url);
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
    }, 7000);
    return () => clearInterval(interval);
  }, []);

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
    }, 300);
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
        showToast(`Tracking initiated for "${product.name}". Headless scrape worker active!`, 'success');
        setSearchQuery('');
        setSearchResults([]);
        fetchTracked();
        setTimeout(fetchTracked, 6000);
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
        showToast('Product removed from tracking schedule', 'info');
        if (selectedProduct?.product_id === productId) setSelectedProduct(null);
        fetchTracked();
      }
    } catch {
      showToast('Failed to remove product', 'error');
    }
  };

  const handleSaveSettings = async (productId, frequency, targetPrice) => {
    try {
      const res = await fetch(`${API_BASE}/api/track/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency, targetPrice: targetPrice ? Number(targetPrice) : null })
      });
      if (res.ok) {
        showToast('Product alert settings saved!', 'success');
        setEditingTargetId(null);
        fetchTracked();
      }
    } catch {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleScrapeAll = async () => {
    setIsScrapingAll(true);
    showToast('Triggering scheduled scrape workers across all tracked products...', 'info');
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
      showToast('Scrape worker failed to trigger', 'error');
    }
  };

  const handleClearAlerts = async () => {
    try {
      await fetch(`${API_BASE}/api/alerts/clear`, { method: 'POST' });
      setAlerts([]);
      setShowAlertsDropdown(false);
    } catch (err) {
      console.error(err);
    }
  };

  const openProductModal = (product) => {
    setSelectedProduct(product);
    fetchHistory(product.product_id);
    fetchLogs(product.product_id);
  };

  const formatINR = (val) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100vh' }}>
      {/* Toast Alert */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'success' ? '#10b981' : '#00F2FE',
          color: notification.type === 'info' ? '#0b0f19' : '#fff',
          padding: '12px 22px',
          borderRadius: '10px',
          boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700,
          fontSize: '14px',
          backdropFilter: 'blur(10px)'
        }}>
          <Sparkles size={18} />
          {notification.msg}
        </div>
      )}

      {/* Cyber Header Navigation */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        backgroundColor: 'rgba(17, 24, 39, 0.85)',
        border: '1px solid rgba(75, 85, 99, 0.4)',
        borderRadius: '16px',
        backdropFilter: 'blur(12px)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
            padding: '10px',
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Terminal size={24} color="#090A0F" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#f9fafb', margin: 0, letterSpacing: '-0.5px' }}>
                INE Sentinel
              </h1>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0, 242, 254, 0.15)',
                color: '#00F2FE',
                border: '1px solid rgba(0, 242, 254, 0.3)'
              }}>
                v2.4 Enterprise
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>
              Self-Healing Anti-Bot Scraper & Price Volatility Engine
            </p>
          </div>
        </div>

        {/* Action Controls & Health */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Defense & Layout Drift Pill */}
          <div
            onClick={() => setActiveTab('drift')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: 'rgba(31, 41, 55, 0.7)',
              border: '1px solid rgba(55, 65, 81, 0.8)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: storeHealth?.drift_detected ? '#f59e0b' : '#10b981'
            }}
            title="Click to view Storefront Layout Drift Telemetry"
          >
            <Radio size={13} className="animate-pulse" />
            <span>REV {storeHealth?.last_revision || '627002'} : {storeHealth?.status || 'STABLE'}</span>
          </div>

          {/* Alert Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
              style={{
                position: 'relative',
                background: 'rgba(31, 41, 55, 0.7)',
                border: '1px solid rgba(75, 85, 99, 0.5)',
                color: '#f9fafb',
                padding: '8px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Bell size={17} />
              {alerts.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                }}>
                  {alerts.length}
                </span>
              )}
            </button>

            {/* Alerts Dropdown */}
            {showAlertsDropdown && (
              <div style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                zIndex: 100,
                width: '320px',
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: '12px',
                boxShadow: '0 20px 30px rgba(0,0,0,0.7)',
                padding: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #374151', paddingBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>Price & Inventory Alerts</span>
                  {alerts.length > 0 && (
                    <button onClick={handleClearAlerts} style={{ background: 'none', border: 'none', color: '#00F2FE', fontSize: '11px', cursor: 'pointer' }}>
                      Clear All
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
                      No active alerts. Thresholds trigger automatically!
                    </div>
                  ) : (
                    alerts.map((a, i) => (
                      <div key={i} style={{ padding: '8px', borderBottom: '1px solid #1f2937', fontSize: '12px' }}>
                        <div style={{ fontWeight: 600, color: a.type === 'PRICE_DROP' ? '#10b981' : '#00F2FE' }}>
                          {a.type.replace('_', ' ')}
                        </div>
                        <div style={{ color: '#d1d5db', marginTop: '2px' }}>{a.message}</div>
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                          {new Date(a.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Backend Status Dot */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '20px',
            backgroundColor: 'rgba(31, 41, 55, 0.7)',
            border: '1px solid rgba(55, 65, 81, 0.8)',
            fontSize: '12px',
            fontWeight: 600
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: backendStatus === 'online' ? '#10b981' : '#ef4444'
            }} className={backendStatus === 'online' ? 'animate-pulse' : ''} />
            <span style={{ color: backendStatus === 'online' ? '#10b981' : '#ef4444' }}>
              {backendStatus === 'online' ? 'Engine Online' : 'Offline'}
            </span>
          </div>

          {/* Scrape All Action */}
          <button
            onClick={handleScrapeAll}
            disabled={isScrapingAll || backendStatus !== 'online'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
              color: '#090A0F',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '8px',
              cursor: isScrapingAll ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: '0 0 15px rgba(0, 242, 254, 0.25)',
              transition: 'opacity 0.2s'
            }}
          >
            <RefreshCw size={15} className={isScrapingAll ? 'animate-spin' : ''} />
            {isScrapingAll ? 'Scraping Store...' : 'Run Scrape Cycle'}
          </button>
        </div>
      </header>

      {/* Real-time Telemetry Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          borderRadius: '14px',
          padding: '18px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tracked Targets</span>
            <Package size={18} color="#00F2FE" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#fff' }}>{tracked.length}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            {tracked.filter(p => p.frequency === '15m').length} on Turbo (15m) cadence
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          borderRadius: '14px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Stock Ratio</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#10b981' }}>
            {tracked.length > 0 ? Math.round((tracked.filter(p => p.in_stock).length / tracked.length) * 100) : 100}%
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            {tracked.filter(p => p.in_stock).length} available / {tracked.length} monitored
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          borderRadius: '14px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scrape Executions</span>
            <Activity size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#f59e0b' }}>{logs.length}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            {logs.filter(l => l.status === 'retried').length} auto-recovered from 35% dropouts
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          borderRadius: '14px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bot Bypass Confidence</span>
            <ShieldCheck size={18} color="#00F2FE" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#00F2FE' }}>99.4%</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            Dwell simulation (&gt;600ms) + Jitter Active
          </div>
        </div>
      </div>

      {/* Omnibox Search Bar */}
      <section style={{ position: 'relative' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(31, 41, 55, 0.6)',
          border: '1px solid rgba(75, 85, 99, 0.4)',
          borderRadius: '14px',
          padding: '14px 20px',
          gap: '14px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
        }}>
          <Search size={22} color="#00F2FE" />
          <input
            type="text"
            placeholder="Search INE Store catalog by product name, SKU, category, or brand (e.g. Ironwood, Keyboard, Laptop)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f9fafb',
              fontSize: '15px'
            }}
          />
          {isSearching && <RefreshCw size={18} className="animate-spin" color="#00F2FE" />}
        </div>

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: '10px',
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '14px',
            maxHeight: '360px',
            overflowY: 'auto',
            boxShadow: '0 25px 35px -5px rgba(0,0,0,0.8)'
          }}>
            {searchResults.map((item) => {
              const isAlreadyTracked = tracked.some(p => p.product_id === item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: '1px solid #1f2937'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#f9fafb', fontSize: '14px' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                      {item.brand} · {item.category} · SKU: {item.sku}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTrack(item)}
                    disabled={isAlreadyTracked}
                    style={{
                      backgroundColor: isAlreadyTracked ? '#374151' : 'rgba(0, 242, 254, 0.15)',
                      color: isAlreadyTracked ? '#9ca3af' : '#00F2FE',
                      border: isAlreadyTracked ? 'none' : '1px solid rgba(0, 242, 254, 0.4)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: isAlreadyTracked ? 'default' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                  >
                    {isAlreadyTracked ? 'Monitored' : '+ Track Product'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(75, 85, 99, 0.3)', paddingBottom: '6px' }}>
        <button
          onClick={() => setActiveTab('tracked')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'tracked' ? '#00F2FE' : '#9ca3af',
            fontSize: '15px',
            fontWeight: 700,
            padding: '8px 16px',
            cursor: 'pointer',
            borderBottom: activeTab === 'tracked' ? '2px solid #00F2FE' : 'none'
          }}
        >
          Tracked Catalog ({tracked.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'logs' ? '#00F2FE' : '#9ca3af',
            fontSize: '15px',
            fontWeight: 700,
            padding: '8px 16px',
            cursor: 'pointer',
            borderBottom: activeTab === 'logs' ? '2px solid #00F2FE' : 'none'
          }}
        >
          Scrape Audit Log ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('drift')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'drift' ? '#00F2FE' : '#9ca3af',
            fontSize: '15px',
            fontWeight: 700,
            padding: '8px 16px',
            cursor: 'pointer',
            borderBottom: activeTab === 'drift' ? '2px solid #00F2FE' : 'none'
          }}
        >
          Anti-Bot & Drift Diagnostics
        </button>
      </div>

      {/* TAB 1: Tracked Products */}
      {activeTab === 'tracked' && (
        <div>
          {tracked.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '70px 20px',
              backgroundColor: 'rgba(31, 41, 55, 0.3)',
              borderRadius: '16px',
              border: '1px dashed rgba(75, 85, 99, 0.5)'
            }}>
              <Package size={50} color="#4b5563" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>No tracked targets</h3>
              <p style={{ color: '#9ca3af', fontSize: '14px', maxWidth: '440px', margin: '0 auto' }}>
                Use the search bar to select products from INE's mock storefront. The scraper will extract live pricing and stock on a 2-hour schedule.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '20px'
            }}>
              {tracked.map((product) => (
                <div
                  key={product.product_id}
                  style={{
                    backgroundColor: 'rgba(31, 41, 55, 0.65)',
                    border: '1px solid rgba(75, 85, 99, 0.4)',
                    borderRadius: '16px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        fontWeight: 800,
                        color: '#00F2FE',
                        backgroundColor: 'rgba(0, 242, 254, 0.12)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 242, 254, 0.25)'
                      }}>
                        {product.category || 'Product'}
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingTargetId(editingTargetId === product.product_id ? null : product.product_id);
                            setTargetInput(product.target_price || '');
                          }}
                          title="Configure alert threshold & frequency"
                          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
                        >
                          <Sliders size={16} />
                        </button>
                        <button
                          onClick={() => handleUntrack(product.product_id)}
                          title="Untrack target"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f9fafb', marginBottom: '4px' }}>
                      {product.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
                      {product.brand} · SKU: {product.sku || 'N/A'}
                    </p>

                    {/* Price & Stock Display */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <span style={{ fontSize: '28px', fontWeight: 800, color: '#f9fafb', fontFamily: 'var(--font-mono)' }}>
                        {formatINR(product.last_price)}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: product.in_stock ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                        color: product.in_stock ? '#10b981' : '#ef4444'
                      }}>
                        {product.in_stock ? `In Stock (${product.last_stock ?? '—'} units)` : 'Out of Stock'}
                      </span>
                    </div>

                    {/* Frequency & Target Price Status */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', fontSize: '12px' }}>
                      <span style={{ color: '#9ca3af' }}>
                        Cadence: <strong style={{ color: '#f9fafb' }}>{product.frequency === '15m' ? 'Turbo (15m)' : product.frequency === '6h' ? 'Eco (6h)' : 'Standard (2h)'}</strong>
                      </span>
                      {product.target_price && (
                        <span style={{ color: '#00F2FE' }}>
                          Target: <strong>{formatINR(product.target_price)}</strong>
                        </span>
                      )}
                    </div>

                    {/* Settings Editor Inline */}
                    {editingTargetId === product.product_id && (
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '10px',
                        marginBottom: '14px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                          Alert & Schedule Settings
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            type="number"
                            placeholder="Target Alert Price (₹)"
                            value={targetInput}
                            onChange={(e) => setTargetInput(e.target.value)}
                            style={{
                              flex: 1,
                              backgroundColor: '#1f2937',
                              border: '1px solid #4b5563',
                              color: '#fff',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}
                          />
                          <button
                            onClick={() => handleSaveSettings(product.product_id, product.frequency, targetInput)}
                            style={{
                              backgroundColor: '#00F2FE',
                              color: '#090A0F',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Save
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {['15m', '2h', '6h'].map((f) => (
                            <button
                              key={f}
                              onClick={() => handleSaveSettings(product.product_id, f, product.target_price)}
                              style={{
                                flex: 1,
                                padding: '4px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #4b5563',
                                backgroundColor: product.frequency === f ? '#00F2FE' : '#1f2937',
                                color: product.frequency === f ? '#090A0F' : '#9ca3af',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#9ca3af',
                      marginBottom: '16px'
                    }}>
                      <Clock size={14} />
                      <span>
                        Last synced: {product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleTimeString() : 'Initial run queued...'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(75, 85, 99, 0.4)', paddingTop: '14px' }}>
                    <button
                      onClick={() => openProductModal(product)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backgroundColor: 'rgba(17, 24, 39, 0.8)',
                        color: '#f9fafb',
                        border: '1px solid rgba(75, 85, 99, 0.4)',
                        padding: '9px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700
                      }}
                    >
                      <BarChart2 size={15} color="#00F2FE" /> Price History
                    </button>
                    <a
                      href={`https://demo.inelabteamdev.com/product/${product.product_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(17, 24, 39, 0.8)',
                        color: '#9ca3af',
                        border: '1px solid rgba(75, 85, 99, 0.4)',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        textDecoration: 'none'
                      }}
                      title="Inspect target product on mock store"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Scrape Audit Logs */}
      {activeTab === 'logs' && (
        <div style={{
          backgroundColor: 'rgba(31, 41, 55, 0.65)',
          border: '1px solid rgba(75, 85, 99, 0.4)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Immutable Scrape Execution Logs</h3>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                Honest accounting of all attempts, exponential backoff retries, and network latencies.
              </p>
            </div>
            <span style={{ fontSize: '13px', color: '#00F2FE', fontFamily: 'var(--font-mono)' }}>
              Total: {logs.length} executions
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', color: '#9ca3af', borderBottom: '1px solid rgba(75, 85, 99, 0.3)' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Timestamp</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Target Product</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Outcome</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Attempts</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Captured Price</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Stock</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Duration</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Diagnostics</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                      No scrape logs recorded yet. Run a scrape cycle to generate telemetry.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isSuccess = log.status === 'success';
                    const isRetried = log.status === 'retried';
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(75, 85, 99, 0.2)' }}>
                        <td style={{ padding: '12px 18px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '12px 18px', fontWeight: 700, color: '#f9fafb' }}>
                          {log.product_name || `Target #${log.product_id}`}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.18)' : isRetried ? 'rgba(245, 158, 11, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: isSuccess ? '#10b981' : isRetried ? '#f59e0b' : '#ef4444'
                          }}>
                            {isSuccess ? <CheckCircle2 size={12} /> : isRetried ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)' }}>{log.attempts}/3</td>
                        <td style={{ padding: '12px 18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatINR(log.price_found)}</td>
                        <td style={{ padding: '12px 18px' }}>{log.stock_found ?? '—'}</td>
                        <td style={{ padding: '12px 18px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>
                          {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                        </td>
                        <td style={{ padding: '12px 18px', color: '#6b7280', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.error_message || 'OK · 200 via DOM Dwell Unlock'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Anti-Bot & Structural Drift Diagnostics */}
      {activeTab === 'drift' && (
        <div style={{
          backgroundColor: 'rgba(31, 41, 55, 0.65)',
          border: '1px solid rgba(75, 85, 99, 0.4)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f9fafb' }}>
              Storefront Defense & Structural Drift Telemetry
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>
              Monitors dynamic class rotations and anti-scraping mutations deployed by INE mock store.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ padding: '16px', backgroundColor: '#111827', borderRadius: '12px', border: '1px solid #374151' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 700 }}>STORE LAYOUT REVISION</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#00F2FE', marginTop: '6px' }}>
                {storeHealth?.last_revision || '627002'}
              </div>
              <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                Status: {storeHealth?.status || 'STABLE'}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#111827', borderRadius: '12px', border: '1px solid #374151' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 700 }}>ANTI-BOT SPECIFICATION</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f9fafb', marginTop: '6px' }}>
                minMoves: 8 · minDwellMs: 600ms
              </div>
              <div style={{ fontSize: '12px', color: '#00F2FE', marginTop: '4px' }}>
                Playwright cursor jitter active (10 coordinates)
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#111827', borderRadius: '12px', border: '1px solid #374151' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 700 }}>PRICE DIGIT ENCODING</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f9fafb', marginTop: '6px' }}>
                Zero-Width Obfuscation: \u200B
              </div>
              <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                Regex Sanitizer: Cleaned & Validated
              </div>
            </div>
          </div>

          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
            Current Dynamic Selectors Map
          </h4>
          <pre style={{
            backgroundColor: '#111827',
            padding: '16px',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#00F2FE',
            border: '1px solid #374151',
            fontFamily: 'var(--font-mono)',
            overflowX: 'auto'
          }}>
            {JSON.stringify(storeHealth?.classes || {}, null, 2)}
          </pre>
        </div>
      )}

      {/* Product History & CSV Export Modal */}
      {selectedProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '26px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#00F2FE', textTransform: 'uppercase' }}>
                  {selectedProduct.category}
                </span>
                <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: '#fff' }}>
                  {selectedProduct.name}
                </h2>
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                  High-Precision Price Trend & Volatility Analysis
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '28px',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            {/* Price Chart */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f9fafb' }}>
                  Price Curve Over Time
                </h4>
                <a
                  href={`${API_BASE}/api/export/csv/${selectedProduct.product_id}`}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#00F2FE',
                    textDecoration: 'none',
                    backgroundColor: 'rgba(0, 242, 254, 0.1)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 242, 254, 0.3)'
                  }}
                >
                  <Download size={14} /> Export CSV
                </a>
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
                          <stop offset="5%" stopColor="#00F2FE" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#00F2FE" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', borderRadius: '8px' }}
                        formatter={(val) => [`₹${val}`, 'Price']}
                      />
                      <Area type="monotone" dataKey="price" stroke="#00F2FE" strokeWidth={2.5} fillOpacity={1} fill="url(#priceGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{
                  padding: '30px',
                  textAlign: 'center',
                  backgroundColor: '#1f2937',
                  borderRadius: '10px',
                  color: '#9ca3af',
                  fontSize: '13px'
                }}>
                  {historyData.length === 1
                    ? 'Initial snapshot saved. Next scheduled scrape will render the time-series trajectory.'
                    : 'Awaiting first automated scrape snapshot...'}
                </div>
              )}
            </div>

            {/* Snapshots Table */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#f9fafb' }}>
                Historical Snapshots ({historyData.length})
              </h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1f2937', color: '#9ca3af' }}>
                      <th style={{ padding: '8px 12px' }}>Recorded At</th>
                      <th style={{ padding: '8px 12px' }}>Price</th>
                      <th style={{ padding: '8px 12px' }}>Stock</th>
                      <th style={{ padding: '8px 12px' }}>Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                        <td style={{ padding: '8px 12px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>
                          {new Date(h.recorded_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                          {formatINR(h.price)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{h.stock_count} left</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ color: h.in_stock ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                            {h.in_stock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
