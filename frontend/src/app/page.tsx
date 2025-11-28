"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileAudio, CheckCircle, AlertCircle, Loader2, Play, Download, Trash2, RefreshCw, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { uploadFile, getStatus, getDownloadUrl, getJobs } from "@/lib/api";
import { VoiceRecorder } from "@/components/VoiceRecorder";

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
  const [voiceInputMethod, setVoiceInputMethod] = useState<"upload" | "record">("upload");

  const [preview, setPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Job History State
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchJobs = async () => {
    setIsRefreshing(true);
    try {
      const data = await getJobs();
      setJobs(data);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Removed automatic polling interval for job history
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
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-8 space-y-12 font-sans">

      {/* Header */}
      <div className="w-full max-w-7xl flex items-center justify-between border-b-4 border-border pb-6">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
          AudioBook<span className="text-primary">Maker</span>
        </h1>
        <div className="hidden md:block text-sm font-bold border-2 border-border px-4 py-2 bg-secondary neo-shadow-sm">
          V1.0.0 BETA
        </div>
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-[1800px] flex flex-col xl:flex-row items-start justify-center gap-8">

        {/* Creation Card */}
        <Card className="w-full xl:flex-1 border-4 border-border neo-shadow-lg rounded-none bg-card overflow-hidden">
          <CardHeader className="border-b-4 border-border bg-muted/50 p-8 text-center">
            <CardTitle className="text-3xl font-black uppercase tracking-tight">
              Create Your Audiobook
            </CardTitle>
            <CardDescription className="text-lg font-medium text-muted-foreground mt-2">
              Transform text into speech with raw power.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">

            {/* Tabs */}
            <div className="flex border-4 border-border neo-shadow-sm">
              <button
                className={`flex-1 py-4 font-black uppercase tracking-wide transition-all ${activeTab === "file"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
                  }`}
                onClick={() => setActiveTab("file")}
              >
                File Upload
              </button>
              <div className="w-1 bg-border"></div>
              <button
                className={`flex-1 py-4 font-black uppercase tracking-wide transition-all ${activeTab === "text"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
                  }`}
                onClick={() => setActiveTab("text")}
              >
                Text Input
              </button>
            </div>

            {/* File Upload Tab */}
            {activeTab === "file" && (
              <div
                className={`border-4 border-dashed rounded-none p-12 text-center transition-all cursor-pointer group ${file
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary hover:bg-muted"
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
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-primary border-4 border-border neo-shadow">
                      <FileAudio className="w-12 h-12 text-primary-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-xl uppercase">{file.name}</p>
                      <p className="text-sm font-mono font-bold text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-muted border-4 border-border group-hover:neo-shadow transition-all">
                      <Upload className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-xl uppercase">
                        Drop PDF/EPUB Here
                      </p>
                      <p className="text-sm font-bold text-muted-foreground">Max 50MB</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Text Input Tab */}
            {activeTab === "text" && (
              <div className="space-y-2">
                <textarea
                  className="w-full h-64 p-6 border-4 border-border rounded-none focus:ring-0 focus:border-primary focus:neo-shadow-sm transition-all font-mono text-sm resize-none"
                  placeholder="PASTE YOUR TEXT HERE..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
              </div>
            )}

            {/* Voice Sample Selection */}
            <div className="space-y-3">
              <label className="text-sm font-black uppercase tracking-wide">
                Voice Sample (Optional)
              </label>

              {/* Voice Input Method Tabs */}
              <div className="flex border-4 border-border neo-shadow-sm">
                <button
                  className={`flex-1 py-3 font-black uppercase text-sm tracking-wide transition-all ${voiceInputMethod === "upload"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                    }`}
                  onClick={() => setVoiceInputMethod("upload")}
                >
                  <Upload className="inline-block w-4 h-4 mr-2" />
                  Upload
                </button>
                <div className="w-1 bg-border"></div>
                <button
                  className={`flex-1 py-3 font-black uppercase text-sm tracking-wide transition-all ${voiceInputMethod === "record"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                    }`}
                  onClick={() => setVoiceInputMethod("record")}
                >
                  <Mic className="inline-block w-4 h-4 mr-2" />
                  Record
                </button>
              </div>

              {/* Upload Tab */}
              {voiceInputMethod === "upload" && (
                <div
                  className="border-4 border-border p-4 flex items-center justify-between cursor-pointer hover:bg-muted transition-all neo-shadow-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  onClick={() => speakerInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={speakerInputRef}
                    className="hidden"
                    accept=".wav,.mp3"
                    onChange={handleSpeakerFileChange}
                  />
                  <span className="font-bold truncate max-w-[200px]">
                    {speakerFile ? speakerFile.name : "UPLOAD WAV/MP3 SAMPLE"}
                  </span>
                  <div className="bg-secondary text-secondary-foreground px-3 py-1 font-bold text-xs border-2 border-border uppercase">
                    Browse
                  </div>
                </div>
              )}

              {/* Record Tab */}
              {voiceInputMethod === "record" && (
                <VoiceRecorder
                  onRecordingComplete={(file) => {
                    setSpeakerFile(file);
                    setVoiceInputMethod("upload"); // Switch back to show the file
                  }}
                  maxDuration={10}
                />
              )}
            </div>

            {/* Preview Checkbox */}
            <div className="flex items-center space-x-4 p-4 border-4 border-border bg-muted/30">
              <input
                type="checkbox"
                id="preview"
                checked={preview}
                onChange={(e) => setPreview(e.target.checked)}
                className="w-6 h-6 border-4 border-border rounded-none text-primary focus:ring-0 cursor-pointer"
              />
              <label htmlFor="preview" className="font-bold uppercase cursor-pointer select-none">
                Preview Mode <span className="text-muted-foreground text-sm normal-case ml-2">(First paragraph only)</span>
              </label>
            </div>

            {/* Progress & Status */}
            {isUploading && (
              <div className="space-y-3 border-4 border-border p-4 bg-accent/20">
                <div className="flex items-center justify-between font-bold uppercase">
                  <span>Starting conversion...</span>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <Progress value={undefined} className="h-4 border-2 border-border rounded-none bg-background [&>div]:bg-primary" />
              </div>
            )}

            {status && status !== "completed" && status !== "failed" && !isUploading && (
              <div className="space-y-3 border-4 border-border p-4 bg-accent/20">
                <div className="flex items-center justify-between font-bold uppercase">
                  <span>{status}... ({progress}%)</span>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <Progress value={progress} className="h-4 border-2 border-border rounded-none bg-background [&>div]:bg-primary" />
              </div>
            )}

            {status === "completed" && (
              <Alert className="border-4 border-border bg-green-100 dark:bg-green-900/30 rounded-none neo-shadow-sm">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                <AlertTitle className="font-black uppercase ml-2">Success!</AlertTitle>
                <AlertDescription className="font-medium ml-2">
                  Your audiobook is ready. Listen below or download it.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="border-4 border-border rounded-none neo-shadow-sm">
                <AlertCircle className="h-6 w-6" />
                <AlertTitle className="font-black uppercase ml-2">Error</AlertTitle>
                <AlertDescription className="font-medium ml-2">{error}</AlertDescription>
              </Alert>
            )}

            {audioUrl && (
              <div className="space-y-6 pt-4">
                <div className="border-4 border-border p-2 bg-background neo-shadow">
                  <audio controls className="w-full h-12" src={audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
                <Button
                  className="w-full h-14 text-lg font-black uppercase border-4 border-border rounded-none neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all bg-green-500 hover:bg-green-400 text-black"
                  asChild
                >
                  <a href={audioUrl} download>
                    <Download className="mr-2 h-6 w-6" /> Download Audiobook
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="p-8 bg-muted/50 border-t-4 border-border">
            {!audioUrl && (
              <Button
                className="w-full h-14 text-lg font-black uppercase border-4 border-border rounded-none neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
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
                className="w-full h-14 text-lg font-black uppercase border-4 border-border rounded-none bg-background hover:bg-muted neo-shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                onClick={() => {
                  setFile(null);
                  setTextInput("");
                  setSpeakerFile(null);
                  setVoiceInputMethod("upload");
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
        <Card className="w-full xl:flex-1 border-4 border-border neo-shadow-lg rounded-none bg-card h-fit">
          <CardHeader className="border-b-4 border-border bg-secondary p-6 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-2xl font-black uppercase">Job History</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchJobs}
              disabled={isRefreshing}
              className="hover:bg-black/10 rounded-none h-10 w-10 border-2 border-transparent hover:border-black"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs font-black uppercase bg-muted border-b-4 border-border">
                  <tr>
                    <th className="px-6 py-4 border-r-4 border-border">File / Text</th>
                    <th className="px-6 py-4 border-r-4 border-border">Status</th>
                    <th className="px-6 py-4 border-r-4 border-border">Date</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-4 divide-border">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center font-bold text-muted-foreground uppercase">
                        No jobs found.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id} className="bg-card hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 font-bold border-r-4 border-border truncate max-w-xs">
                          {job.filename}
                        </td>
                        <td className="px-6 py-4 border-r-4 border-border">
                          <span className={`px-3 py-1 font-bold border-2 border-border text-xs uppercase ${job.status === "completed" ? "bg-green-300 text-black" :
                            job.status === "failed" ? "bg-red-300 text-black" :
                              "bg-blue-300 text-black"
                            }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-r-4 border-border font-mono text-xs">
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {job.status === "completed" && (
                            <a
                              href={getDownloadUrl(job.id)}
                              className="inline-flex items-center font-black uppercase text-primary hover:underline"
                              download
                            >
                              <Download className="w-4 h-4 mr-1" /> Download
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
    </div>
  );
}
