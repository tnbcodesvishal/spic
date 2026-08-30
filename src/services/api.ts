const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api" : "https://spic-backend.onrender.com/api");


export interface RegistrationPayload {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  name: string;
  email: string;
  phone?: string;
  rollNumber: string;
  year: string;
  branch: string;
}

export interface Registration {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  participantName: string;
  participantEmail: string;
  qrDataUrl: string;
  emailStatus: "pending" | "sent" | "failed";
  checkedIn: boolean;
  createdAt: string;
}

export interface VerifyPayload {
  registrationId: string;
  eventId: string;
  verificationToken: string;
}

export interface VerifyResult {
  valid: boolean;
  participantName?: string;
  participantEmail?: string;
  eventName?: string;
  error?: string;
}

export interface TeamMember {
  name: string;
  email: string;
  rollNumber: string;
  year: string;
  branch: string;
  phone: string;
}

export interface TeamRegistrationPayload {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  teamName: string;
  members: TeamMember[];
  pptLink: string;
}

export interface TeamRegistrationResponse {
  id: string;
  teamName: string;
  qrDataUrl: string;
  message: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const contentType = res.headers.get("content-type");
  let data: any;
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = { error: await res.text() };
  }

  if (!res.ok) {
    throw new Error(data.error || data.detail || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  register(payload: RegistrationPayload) {
    return request<Registration>("/registrations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  registerTeam(payload: TeamRegistrationPayload) {
    return request<TeamRegistrationResponse>("/registrations/team", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  registerPPT(formData: FormData) {
    const url = `${BASE}/upload/ppt`;
    return fetch(url, {
      method: "POST",
      body: formData,
    }).then(async (res) => {
      const contentType = res.headers.get("content-type");
      let data: any;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { error: await res.text() };
      }
      if (!res.ok) {
        throw new Error(data.error || data.detail || `Upload failed with status ${res.status}`);
      }
      return data as { url: string };
    });
  },

  uploadPPT(formData: FormData) {
    return this.registerPPT(formData);
  },

  getRegistrations(email: string) {
    return request<Registration[]>(`/registrations?email=${encodeURIComponent(email)}`);
  },

  verify(payload: VerifyPayload) {
    return request<VerifyResult>("/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  contact(payload: { name: string; email: string; concern: string }) {
    return request<{ success: boolean; message: string }>("/contact", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
