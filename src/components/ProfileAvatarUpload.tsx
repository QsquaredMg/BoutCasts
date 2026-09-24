"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FileUploadPicker from "@/components/FileUploadPicker";

export default function ProfileAvatarUpload({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUploaded(url: string | null) {
    if (!url) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs font-semibold underline"
        style={{ color: "var(--text-faint)" }}
      >
        Change photo
      </button>
    );
  }

  return (
    <div className="w-full max-w-xs">
      <FileUploadPicker onUploaded={handleUploaded} />
      {saving && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          Saving…
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs font-semibold" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="mt-1 text-xs font-semibold"
        style={{ color: "var(--text-faint)" }}
      >
        Cancel
      </button>
    </div>
  );
}
