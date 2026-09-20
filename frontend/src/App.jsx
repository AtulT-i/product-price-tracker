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
  ChevronRight,
  BarChart2,
  ShieldCheck,
  Eye
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('tracked');
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [notification, setNotification] = useState(null);

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
    const interval = setInterval(() => {
      checkHealth();
      fetchTracked();
      fetchLogs();
    }, 8000);
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
        showToast(`Tracking started for "${product.name}". Initial scrape running!`, 'success');
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
    if (!confirm('Are you sure you want to stop tracking this product?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/track/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Product removed from tracking', 'info');
        if (selectedProduct?.product_id === productId) setSelectedProduct(null);
        fetchTracked();
      }
    } catch {
      showToast('Failed to remove product', 'error');
    }
  };

  const handleScrapeAll = async () => {
    setIsScrapingAll(true);
    showToast('Scheduled scrape initiated for all tracked products...', 'info');
    try {
      await fetch(`${API_BASE}/api/scrape-now`, { method: 'POST' });
      setTimeout(() => {
        setIsScrapingAll(false);
        fetchTracked();
        fetchLogs();
      }, 5000);
    } catch {
      setIsScrapingAll(false);
      showToast('Scrape trigger failed', 'error');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 100,
          backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'success' ? '#10b981' : '#6366f1',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px'
        }}>
          {notification.msg}
        </div>
      )}

      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Package size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              INE Price Tracker
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Automated scraping & resilience monitor for INE Store
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            fontSize: '13px',
            fontWeight: 500
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: backendStatus === 'online' ? '#10b981' : '#ef4444'
            }} className={backendStatus === 'online' ? 'animate-pulse' : ''} />
            <span style={{ color: backendStatus === 'online' ? '#10b981' : '#ef4444' }}>
              {backendStatus === 'online' ? 'Backend Online' : 'Backend Offline'}
            </span>
          </div>

          <button
            onClick={handleScrapeAll}
            disabled={isScrapingAll || backendStatus !== 'online'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '8px',
              cursor: isScrapingAll ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              opacity: isScrapingAll ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            <RefreshCw size={16} className={isScrapingAll ? 'animate-spin' : ''} />
            {isScrapingAll ? 'Scraping All...' : 'Run Scrape Now'}
          </button>
        </div>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Tracked Products</span>
            <Package size={18} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{tracked.length}</div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>In Stock</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>
            {tracked.filter(p => p.in_stock).length}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Scrape Attempts</span>
            <Activity size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{logs.length}</div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Scraper Resilience</span>
            <ShieldCheck size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>
            Multi-Retry + Anti-Bot Bypassed
          </div>
        </div>
      </div>

      <section style={{ position: 'relative' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 16px',
          gap: '12px'
        }}>
          <Search size={20} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search INE mock store by product name, category, or brand (e.g. Ironwood, Keyboard, Laptop)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '15px'
            }}
          />
          {isSearching && <RefreshCw size={18} className="animate-spin" color="var(--text-secondary)" />}
        </div>

        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: '8px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            maxHeight: '340px',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
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
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {item.brand} · {item.category} · SKU: {item.sku}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTrack(item)}
                    disabled={isAlreadyTracked}
                    style={{
                      backgroundColor: isAlreadyTracked ? '#374151' : 'var(--accent-primary)',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      cursor: isAlreadyTracked ? 'default' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    {isAlreadyTracked ? 'Tracked' : '+ Track Product'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('tracked')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'tracked' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontSize: '16px',
            fontWeight: 700,
            padding: '8px 14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'tracked' ? '2px solid var(--accent-primary)' : 'none'
          }}
        >
          Tracked Products ({tracked.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'logs' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontSize: '16px',
            fontWeight: 700,
            padding: '8px 14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'logs' ? '2px solid var(--accent-primary)' : 'none'
          }}
        >
          Scrape Audit Logs ({logs.length})
        </button>
      </div>

      {activeTab === 'tracked' && (
        <div>
          {tracked.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px dashed var(--border)'
            }}>
              <Package size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>No products tracked yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
                Use the search bar above to find items in INE's mock storefront and start tracking price and stock trends.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '18px'
            }}>
              {tracked.map((product) => (
                <div
                  key={product.product_id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s, border-color 0.15s'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: 'var(--accent-primary)',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        {product.category || 'Product'}
                      </span>
                      <button
                        onClick={() => handleUntrack(product.product_id)}
                        title="Stop tracking"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {product.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      {product.brand} · SKU: {product.sku || 'N/A'}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatINR(product.last_price)}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: product.in_stock ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: product.in_stock ? '#10b981' : '#ef4444'
                      }}>
                        {product.in_stock ? `In Stock (${product.last_stock ?? '—'} left)` : 'Out of Stock'}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginBottom: '18px'
                    }}>
                      <Clock size={14} />
                      <span>
                        Last scraped: {product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleTimeString() : 'Pending initial scrape...'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <button
                      onClick={() => openProductModal(product)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        padding: '8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      <BarChart2 size={15} /> Price History
                    </button>
                    <a
                      href={`https://demo.inelabteamdev.com/product/${product.product_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        textDecoration: 'none'
                      }}
                      title="View on INE Store"
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

      {activeTab === 'logs' && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Scrape Execution & Resilience Logs</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Total Records: {logs.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Product</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Attempts</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Price</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Stock</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Duration</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No scrape logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isSuccess = log.status === 'success';
                    const isRetried = log.status === 'retried';
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.product_name || `#${log.product_id}`}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.15)' : isRetried ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isSuccess ? '#10b981' : isRetried ? '#f59e0b' : '#ef4444'
                          }}>
                            {isSuccess ? <CheckCircle2 size={12} /> : isRetried ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>{log.attempts}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600 }}>{formatINR(log.price_found)}</td>
                        <td style={{ padding: '12px 18px' }}>{log.stock_found ?? '—'}</td>
                        <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                          {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                        </td>
                        <td style={{ padding: '12px 18px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.error_message || 'Resolved successfully'}
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

      {selectedProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 90,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                  {selectedProduct.category}
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                  {selectedProduct.name}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Price & Stock History Log
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
                Price Trend Over Time
              </h4>
              {historyData.length > 1 ? (
                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData.map(h => ({
                      time: new Date(h.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      price: Number(h.price)
                    }))}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', borderRadius: '8px' }}
                        formatter={(val) => [`₹${val}`, 'Price']}
                      />
                      <Area type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#priceGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{
                  padding: '30px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px'
                }}>
                  {historyData.length === 1
                    ? 'Initial price point recorded. Further scheduled scrapes will plot the trend line.'
                    : 'Awaiting first scrape snapshot...'}
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
                Recorded Snapshots
              </h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 12px' }}>Time</th>
                      <th style={{ padding: '8px 12px' }}>Price</th>
                      <th style={{ padding: '8px 12px' }}>Stock</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                          {new Date(h.recorded_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{formatINR(h.price)}</td>
                        <td style={{ padding: '8px 12px' }}>{h.stock_count} units</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ color: h.in_stock ? '#10b981' : '#ef4444', fontWeight: 600 }}>
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
