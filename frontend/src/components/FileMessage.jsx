import { FileText } from "lucide-react";

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const FileMessage = ({ fileName, sizeInBytes, onDownload }) => {
  return (
    <div
      onClick={onDownload}
      className="flex items-center gap-3 bg-base-200 rounded-xl p-2 pr-4 min-w-[240px] max-w-[200px] cursor-pointer hover:bg-base-300 transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-base-content truncate" title={fileName}>
          {fileName}
        </p>
        <p className="text-xs text-base-content/60">{formatBytes(sizeInBytes)}</p>
      </div>
    </div>
  );
};

export { FileMessage, formatBytes };
