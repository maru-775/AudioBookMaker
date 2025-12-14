import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
});

export const uploadFile = async (file: File | null, text: string | null, speakerFile?: File, preview: boolean = false) => {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  if (text) {
    formData.append("text", text);
  }
  if (speakerFile) {
    formData.append("speaker_file", speakerFile);
  }
  formData.append("preview", preview.toString());

  const response = await api.post("/api/convert", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getStatus = async (jobId: string) => {
  const response = await api.get(`/api/status/${jobId}`);
  return response.data;
};

export const getJobs = async () => {
  const response = await api.get("/api/jobs");
  return response.data;
};

export const getDownloadUrl = (jobId: string) => {
  return `${API_URL}/api/download/${jobId}`;
};
