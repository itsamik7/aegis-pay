const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getAuthToken(): string | null {
  return localStorage.getItem('aegis_auth_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('aegis_auth_token', token);
  } else {
    localStorage.removeItem('aegis_auth_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, errorDetail);
  }

  // Handle CSV/text downloads
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    const text = await response.text();
    return text as unknown as T;
  }

  return response.json();
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<any>('/auth/me'),
  getDemoUsers: () => request<any[]>('/auth/demo-users'),

  // Analytics / Overview
  getOverview: (days = 30) => request<any>(`/analytics/overview?days=${days}`),

  // Merchants
  getMerchants: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<any>(`/merchants?${query.toString()}`);
  },
  getMerchantDetail: (id: string) => request<any>(`/merchants/${id}`),

  // Transactions
  getTransactions: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<any>(`/transactions?${query.toString()}`);
  },
  getTransactionDetail: (id: string) => request<any>(`/transactions/${id}`),

  // Alerts
  getAlerts: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<any>(`/alerts?${query.toString()}`);
  },
  getAlertDetail: (id: string) => request<any>(`/alerts/${id}`),
  updateAlert: (id: string, payload: any) =>
    request<any>(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  bulkAssignAlerts: (payload: { alert_ids: string[]; analyst_id: number; rationale: string }) =>
    request<any>('/alerts/bulk-assign', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Cases
  getCases: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<any>(`/cases?${query.toString()}`);
  },
  getCaseDetail: (id: string) => request<any>(`/cases/${id}`),
  createCase: (payload: any) =>
    request<any>('/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  addCaseNote: (id: string, payload: { note_type: string; content: string }) =>
    request<any>(`/cases/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  recommendCaseAction: (id: string, payload: { recommendation: string; rationale: string }) =>
    request<any>(`/cases/${id}/recommendation`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitReviewDecision: (id: string, payload: { decision: string; rationale: string }) =>
    request<any>(`/cases/${id}/review-decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeCase: (id: string, payload: { status: string; reason: string }) =>
    request<any>(`/cases/${id}/close`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  reopenCase: (id: string, payload: { reason: string }) =>
    request<any>(`/cases/${id}/reopen`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Merchant Information Requests
  getMerchantRequests: (merchantId?: string) =>
    request<any[]>(`/merchant-requests${merchantId ? `?merchant_id=${merchantId}` : ''}`),
  createMerchantRequest: (payload: any) =>
    request<any>('/merchant-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitMerchantResponse: (requestId: string, payload: { response_text: string; attachment_filenames?: string[] }) =>
    request<any>(`/merchant-requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Risk Engine & Policy
  getRiskSignals: () => request<any[]>('/risk/signals'),
  getRiskConfig: () => request<any>('/risk/config'),
  updateRiskConfig: (payload: any) =>
    request<any>('/risk/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getRiskConfigVersions: () => request<any[]>('/risk/config/versions'),
  rollbackRiskConfig: (payload: { target_version: string; rationale: string }) =>
    request<any>('/risk/config/rollback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  evaluateMerchant: (merchantId: string, windowHours = 48) =>
    request<any>(`/risk/evaluate/${merchantId}?window_hours=${windowHours}`),

  // Simulation Lab
  getSimulationScenarios: () => request<any[]>('/simulation/scenarios'),
  getAdversarialTests: () => request<any[]>('/simulation/adversarial-tests'),
  getSimulationRuns: () => request<any[]>('/simulation/runs'),
  runSimulation: (payload: any) =>
    request<any>('/simulation/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSyntheticEvaluation: (ablation?: string) =>
    request<any>(`/simulation/evaluate${ablation ? `?ablation=${ablation}` : ''}`),
  calculatePrevalence: (payload: any) =>
    request<any>('/simulation/prevalence', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetDemoData: () =>
    request<any>('/simulation/reset', {
      method: 'POST',
    }),

  // Audit
  getAuditTrail: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<any>(`/audit?${query.toString()}`);
  },

  // Reports
  getRiskDistributionReport: () => request<any[]>('/reports/risk-distribution'),
  getAlertsBySignalReport: () => request<any[]>('/reports/alerts-by-signal'),
  getCaseOutcomesReport: () => request<any[]>('/reports/case-outcomes'),

  // Notifications
  getNotifications: () => request<any[]>('/notifications'),
  markNotificationRead: (id: number) =>
    request<any>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  // Global Search
  search: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),
};
