export type FileType = {
  id: string;
  label: string;
  extension: string;
  icon: string;
  defaultBaseName: string;
  initialContent: string;
};

// Add a file type here to make it available in the browser's create menu.
export const fileTypes: FileType[] = [
  {
    id: "text-document",
    label: "Text document",
    extension: ".txt",
    icon: "▤",
    defaultBaseName: "Untitled document",
    initialContent: "",
  },
];

const fallbackFileType: FileType = {
  id: "unknown",
  label: "File",
  extension: "",
  icon: "▧",
  defaultBaseName: "Untitled file",
  initialContent: "",
};

export function fileTypeForName(name: string): FileType {
  const normalizedName = name.toLowerCase();
  return (
    fileTypes.find((type) => normalizedName.endsWith(type.extension)) ??
    fallbackFileType
  );
}

export function fileNameFor(type: FileType, baseName: string): string {
  const trimmedName = baseName.trim();
  return trimmedName.toLowerCase().endsWith(type.extension)
    ? trimmedName
    : `${trimmedName}${type.extension}`;
}
