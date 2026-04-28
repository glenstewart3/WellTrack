import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api';
import {
  TrendingUp, Calendar, ChevronDown, ChevronUp, Users,
  BarChart2, ArrowRight, Download, School, Target
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// ── Term Comparison Page ─────────────────────────────────────────────────────
export default function TermComparisonPage() {
  useDocumentTitle('Term Comparison');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canDo } = usePermissions();
  
  // Term selection
  const [availableTerms, setAvailableTerms] = useState([]);
  const [selectedTerms, setSelectedTerms] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeMetric, setActiveMetric] = useState('tier'); // tier, saebrs, attendance, interventions
  
  // Fetch available terms on mount - before permission check
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await api.get('/screening/available-terms');
        const terms = res.data || [];
        setAvailableTerms(terms);
        // Auto-select last 2 terms
        if (terms.length >= 2) {
          setSelectedTerms(terms.slice(-2));
        } else if (terms.length === 1) {
          setSelectedTerms(terms);
        }
      } catch (e) {
        console.error('Failed to fetch terms:', e);
      }
    };
    fetchTerms();
  }, []);

  // Fetch comparison data when terms change
  useEffect(() => {
    if (selectedTerms.length < 1) return;
    
    const fetchComparison = async () => {
      setLoading(true);
      try {
        const res = await api.post('/analytics/term-comparison', {
          terms: selectedTerms
        });
        setComparisonData(res.data);
      } catch (e) {
        console.error('Failed to fetch comparison:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchComparison();
  }, [selectedTerms]);

  // Toggle term selection
  const toggleTerm = (term) => {
    if (selectedTerms.find(t => t.term === term.term && t.year === term.year)) {
      setSelectedTerms(selectedTerms.filter(t => !(t.term === term.term && t.year === term.year)));
    } else {
      setSelectedTerms([...selectedTerms, term]);
    }
  };

  // Chart data preparation
  const chartData = useMemo(() => {
    if (!comparisonData) return null;
    
    const labels = comparisonData.terms.map(t => `${t.term} ${t.year}`);
    
    if (activeMetric === 'tier') {
      return {
        labels,
        datasets: [
          {
            label: 'Tier 1',
            data: comparisonData.data.map(d => d.tier1_count),
            backgroundColor: 'rgba(34, 197, 94, 0.6)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 2,
          },
          {
            label: 'Tier 2',
            data: comparisonData.data.map(d => d.tier2_count),
            backgroundColor: 'rgba(245, 158, 11, 0.6)',
            borderColor: 'rgba(245, 158, 11, 1)',
            borderWidth: 2,
          },
          {
            label: 'Tier 3',
            data: comparisonData.data.map(d => d.tier3_count),
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2,
          },
        ],
      };
    } else if (activeMetric === 'saebrs') {
      return {
        labels,
        datasets: [
          {
            label: 'Average SAEBRS Total',
            data: comparisonData.data.map(d => d.avg_saebrs_total),
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      };
    } else if (activeMetric === 'attendance') {
      return {
        labels,
        datasets: [
          {
            label: 'Average Attendance %',
            data: comparisonData.data.map(d => d.avg_attendance),
            borderColor: 'rgba(168, 85, 247, 1)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      };
    }
    
    return null;
  }, [comparisonData, activeMetric]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Calculate trends
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(1);
  };

  // Permission check - render permission denied instead of early return
  if (!canDo('analytics.view')) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">You don't have permission to view term comparisons.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <TrendingUp size={28} className="text-slate-600" /> Term Comparison
          </h1>
          <p className="text-slate-500 mt-1">Compare wellbeing data across terms and years.</p>
        </div>
        <button
          onClick={() => navigate('/analytics')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <BarChart2 size={16} /> Back to Analytics
        </button>
      </div>

      {/* Term Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Calendar size={16} /> Select Terms to Compare
        </label>
        <div className="flex flex-wrap gap-2">
          {availableTerms.map((term) => {
            const isSelected = selectedTerms.find(
              t => t.term === term.term && t.year === term.year
            );
            return (
              <button
                key={`${term.year}-${term.term}`}
                onClick={() => toggleTerm(term)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {term.term} {term.year}
              </button>
            );
          })}
        </div>
        {selectedTerms.length === 0 && (
          <p className="text-sm text-rose-600 mt-2">Select at least one term to view data.</p>
        )}
      </div>

      {/* Metric Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { id: 'tier', label: 'MTSS Tiers', icon: Target },
          { id: 'saebrs', label: 'SAEBRS Scores', icon: BarChart2 },
          { id: 'attendance', label: 'Attendance', icon: School },
        ].map((metric) => (
          <button
            key={metric.id}
            onClick={() => setActiveMetric(metric.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeMetric === metric.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <metric.icon size={16} />
            {metric.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <div className="w-8 h-8 border-4 border-slate-900/20 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading comparison data...</p>
        </div>
      )}

      {/* Data Display */}
      {!loading && comparisonData && (
        <div className="space-y-6">
          {/* Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {activeMetric === 'tier' && 'Student Distribution by MTSS Tier'}
              {activeMetric === 'saebrs' && 'Average SAEBRS Scores Over Time'}
              {activeMetric === 'attendance' && 'Attendance Trends'}
            </h3>
            <div className="h-80">
              {chartData && (
                activeMetric === 'tier' ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <Line data={chartData} options={chartOptions} />
                )
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {comparisonData.data.map((termData, index) => {
              const prevData = index > 0 ? comparisonData.data[index - 1] : null;
              
              return (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-5">
                  <h4 className="text-sm font-medium text-slate-500 mb-3">
                    {termData.term} {termData.year}
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Students Screened</span>
                      <span className="font-semibold text-slate-900">{termData.students_screened}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Tier 3 %</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {termData.tier3_percentage}%
                        </span>
                        {prevData && (
                          <TrendIndicator 
                            trend={calculateTrend(termData.tier3_percentage, prevData.tier3_percentage)}
                            inverse={true} // Lower is better for Tier 3
                          />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Avg SAEBRS</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {termData.avg_saebrs_total}
                        </span>
                        {prevData && (
                          <TrendIndicator 
                            trend={calculateTrend(termData.avg_saebrs_total, prevData.avg_saebrs_total)}
                          />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Avg Attendance</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {termData.avg_attendance}%
                        </span>
                        {prevData && (
                          <TrendIndicator 
                            trend={calculateTrend(termData.avg_attendance, prevData.avg_attendance)}
                          />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Active Interventions</span>
                      <span className="font-semibold text-slate-900">{termData.active_interventions}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Detailed Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Term</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Screened</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Tier 1</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Tier 2</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Tier 3</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Avg SAEBRS</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Attendance</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Interventions</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.data.map((termData, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {termData.term} {termData.year}
                      </td>
                      <td className="py-3 px-4 text-right">{termData.students_screened}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-emerald-600">{termData.tier1_count}</span>
                        <span className="text-xs text-slate-400 ml-1">({termData.tier1_percentage}%)</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-amber-600">{termData.tier2_count}</span>
                        <span className="text-xs text-slate-400 ml-1">({termData.tier2_percentage}%)</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-rose-600">{termData.tier3_count}</span>
                        <span className="text-xs text-slate-400 ml-1">({termData.tier3_percentage}%)</span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{termData.avg_saebrs_total}</td>
                      <td className="py-3 px-4 text-right">{termData.avg_attendance}%</td>
                      <td className="py-3 px-4 text-right">{termData.active_interventions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trend Indicator Component ───────────────────────────────────────────────
function TrendIndicator({ trend, inverse = false }) {
  if (trend === null) return null;
  
  const numTrend = parseFloat(trend);
  const isPositive = inverse ? numTrend < 0 : numTrend > 0;
  const isNegative = inverse ? numTrend > 0 : numTrend < 0;
  
  return (
    <span className={`text-xs font-medium ${
      isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-400'
    }`}>
      {numTrend > 0 ? '↑' : numTrend < 0 ? '↓' : '→'} {Math.abs(numTrend)}%
    </span>
  );
}
