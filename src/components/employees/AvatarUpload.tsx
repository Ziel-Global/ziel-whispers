import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";

type Props = {
  currentUrl?: string;
  onFileChange: (file: File | null) => void;
};

export function AvatarUpload({ currentUrl, onFileChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setPreview(URL.createObjectURL(file));
    onFileChange(file);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={preview || currentUrl} />
        <AvatarFallback className="bg-muted text-muted-foreground"><Camera className="h-6 w-6" /></AvatarFallback>
      </Avatar>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Upload Photo
        </Button>
        <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG or PNG</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} />
      </div>
    </div>
  );
}
