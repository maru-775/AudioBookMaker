"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileAudio, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { uploadFile, getStatus, getDownloadUrl, getJobs } from "@/lib/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [speakerFile, setSpeakerFile] = useState<File | null>(null);
  const speakerInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState(false);
  const [progress, setProgress] = useState(0);

  // Job History State
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Refresh history every 5s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (jobId && status !== "completed" && status !== "failed") {
      interval = setInterval(async () => {
        try {
          const data = await getStatus(jobId);
          setStatus(data.status);

          // Update progress
          if (data.total_blocks > 0) {
            const percentage = Math.round((data.completed_blocks / data.total_blocks) * 100);
            setProgress(percentage);
          }

          if (data.status === "completed") {
            setAudioUrl(getDownloadUrl(jobId));
            setProgress(100);
            fetchJobs(); // Refresh history on completion
          } else if (data.status === "failed") {
            setError(data.error || "Conversion failed");
            fetchJobs();
          }
        } catch (err) {
          console.error("Error polling status:", err);
        }
      }, 1000); // Poll faster for progress updates
    }

    return () => clearInterval(interval);
  }, [jobId, status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      resetState();
    }
  };

  const handleSpeakerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSpeakerFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setActiveTab("file");
      resetState();
    }
  };

  const resetState = () => {
    setError(null);
    setStatus(null);
    setJobId(null);
    setAudioUrl(null);
    setProgress(0);
  };

  const handleUpload = async () => {
    if (activeTab === "file" && !file) return;
    if (activeTab === "text" && !textInput.trim()) return;

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const data = await uploadFile(
        activeTab === "file" ? file : null,
        activeTab === "text" ? textInput : null,
        speakerFile || undefined,
        preview
      );
      setJobId(data.job_id);
      setStatus("queued");
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to start conversion. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center p-4 space-y-8">
      <Card className="w-full max-w-2xl shadow-xl border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            AudioBook Maker
          </CardTitle>
          <CardDescription>
            Transform your books or text into immersive audiobooks with AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Tabs */}
          <div className="flex space-x-4 border-b">
            <button
              className={`pb-2 px-4 font-medium ${activeTab === "file" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("file")}
            >
              File Upload
            </button>
            <button
              className={`pb-2 px-4 font-medium ${activeTab === "text" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("text")}
            >
              Text Input
            </button>
          </div>

          {/* File Upload Tab */}
          {activeTab === "file" && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${file ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 hover:border-gray-400 dark:border-gray-700"
                }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".epub,.pdf"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex flex-col items-center space-y-2">
                  <FileAudio className="w-12 h-12 text-blue-500" />
                  <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="w-12 h-12 text-gray-400" />
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    Click to upload Book (PDF/EPUB)
                  </p>
                  <p className="text-sm text-gray-500">Max 50MB</p>
                </div>
              )}
            </div>
          )}

          {/* Text Input Tab */}
          {activeTab === "text" && (
            <div className="space-y-2">
              <textarea
                className="w-full h-48 p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700"
                placeholder="Paste your text here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
            </div>
          )}

          {/* Speaker Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice Sample (Optional)
            </label>
            <div
              className="border rounded-md p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => speakerInputRef.current?.click()}
            >
              <input
                type="file"
                ref={speakerInputRef}
                className="hidden"
                accept=".wav,.mp3"
                onChange={handleSpeakerFileChange}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {speakerFile ? speakerFile.name : "Upload a 10s voice sample (.wav)"}
              </span>
              <Button variant="ghost" size="sm">Browse</Button>
            </div>
          </div>

          {/* Preview Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="preview"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="preview" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Preview Mode (Generate only first paragraph)
            </label>
          </div>

          {/* Progress & Status */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Starting conversion...</span>
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {status && status !== "completed" && status !== "failed" && !isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{status}... ({progress}%)</span>
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {status === "completed" && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Your audiobook is ready. Listen below or download it.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {audioUrl && (
            <div className="space-y-4 pt-4">
              <audio controls className="w-full" src={audioUrl}>
                Your browser does not support the audio element.
              </audio>
              <Button className="w-full" asChild>
                <a href={audioUrl} download>
                  Download Audiobook
                </a>
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!audioUrl && (
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={
                (activeTab === "file" && !file) ||
                (activeTab === "text" && !textInput.trim()) ||
                isUploading ||
                (!!status && status !== "failed")
              }
            >
              {isUploading ? "Starting..." : status && status !== "failed" ? "Processing..." : "Convert to Audio"}
            </Button>
          )}
          {audioUrl && (
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => {
                setFile(null);
                setTextInput("");
                setSpeakerFile(null);
                setAudioUrl(null);
                setStatus(null);
                setJobId(null);
              }}
            >
              Convert Another Book
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Job History Table */}
      <Card className="w-full max-w-4xl shadow-lg border-0">
        <CardHeader>
          <CardTitle>Job History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-3">File / Text</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No jobs found.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white truncate max-w-xs">
                        {job.filename}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${job.status === "completed" ? "bg-green-100 text-green-800" :
                          job.status === "failed" ? "bg-red-100 text-red-800" :
                            "bg-blue-100 text-blue-800"
                          }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {job.status === "completed" && (
                          <a
                            href={getDownloadUrl(job.id)}
                            className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                            download
                          >
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
