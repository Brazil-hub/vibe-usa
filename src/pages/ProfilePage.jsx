import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
  const { user, logoutUser } = useAuth();
  const [profile, setProfile] = useState(null);

  const [loadingDelete, setLoadingDelete] = useState(false);

  // avatar
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState("");

  // editar nome
  const [showEditModal, setShowEditModal] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 🔒 ADICIONADO: handler EXISTENTE para não quebrar mobile
  async function handleDeleteAccount() {
    setLoadingDelete(true);
    alert("Account deletion is currently under maintenance.");
    setLoadingDelete(false);
    setShowDeleteModal(false);
  }

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        if (mounted) {
          setProfile(data);
          setNameDraft(data.name || "");
        }
      } else {
        console.error("Erro carregando perfil:", error);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) return <p>Please log in again.</p>;

  if (!profile)
    return <p style={{ padding: 20 }}>Loading profile…</p>;

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile?.name || profile?.email || "User"
  )}&background=random&size=256`;

  const avatar = avatarPreview || profile?.avatar_url || fallbackAvatar;

  function openFilePicker() {
    setAvatarError("");
    fileInputRef.current?.click();
  }

  async function compressAvatar(file) {
    return await imageCompression(file, {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 512,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
  }

  async function handleAvatarSelected(e) {
    const originalFile = e.target.files[0];
    if (!originalFile) return;

    const previewUrl = URL.createObjectURL(originalFile);
    setAvatarPreview(previewUrl);
    setUploadingAvatar(true);

    try {
      const compressed = await compressAvatar(originalFile);
      const path = `${user.id}/avatar_${Date.now()}.jpg`;

      await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true });

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);

      setProfile((p) => ({ ...p, avatar_url: data.publicUrl }));
    } catch (err) {
      console.error(err);
      setAvatarError("Error updating photo.");
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile() {
    if (!nameDraft.trim()) {
      setProfileError("Name can't be empty.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: nameDraft.trim() })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => ({ ...prev, name: nameDraft.trim() }));
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      setProfileError("Error saving profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={handleAvatarSelected}
      />

      <div className={styles.header}>
        <img src={avatar} className={styles.avatarSmall} />
        <div>
          <h2 className={styles.title}>My Profile</h2>
          <p className={styles.email}>{profile.email}</p>
        </div>
      </div>

      <div className={styles.avatarSection}>
        <img src={avatar} className={styles.avatarBig} />

        <button
          className={`${styles.buttonPrimary} ${
            uploadingAvatar ? styles.buttonPrimaryDisabled : ""
          }`}
          onClick={openFilePicker}
          disabled={uploadingAvatar}
        >
          {uploadingAvatar ? "Updating photo..." : "Change Photo"}
        </button>

        {avatarError && <p className={styles.error}>{avatarError}</p>}
      </div>

      <div className={styles.info}>
        <p><strong>Name:</strong> {profile.name || "No name"}</p>
        <p><strong>Email:</strong> {profile.email}</p>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.buttonBlue}
          onClick={() => setShowEditModal(true)}
        >
          Edit Profile
        </button>

        <button className={styles.buttonGray} onClick={logoutUser}>
          Sign Out
        </button>

        <button
          className={styles.buttonRed}
          onClick={() => setShowDeleteModal(true)}
        >
          Delete Account
        </button>
      </div>

      {/* MODAL EXCLUIR CONTA */}
      {showDeleteModal && (
        <div
          onClick={() => setShowDeleteModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              width: "90%",
              maxWidth: 340,
              textAlign: "center",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Delete account</h3>

            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#555" }}>
              This action is <strong>permanent</strong>. Are you sure?
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className={styles.buttonGray}
                onClick={() => setShowDeleteModal(false)}
                disabled={loadingDelete}
              >
                Cancel
              </button>

              <button
                className={styles.buttonRed}
                onClick={handleDeleteAccount}
                disabled={loadingDelete}
              >
                {loadingDelete ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR NOME */}
      {showEditModal && (
        <div
          onClick={() => setShowEditModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              padding: 20,
              width: "90%",
              maxWidth: 320,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Edit Name</h3>

            <input
              className={styles.input}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              autoFocus
            />

            {profileError && (
              <p className={styles.error}>{profileError}</p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className={styles.buttonGray}
                onClick={() => {
                  setShowEditModal(false);
                  setNameDraft(profile.name || "");
                  setProfileError("");
                }}
              >
                Cancel
              </button>

              <button
                className={styles.buttonBlue}
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
