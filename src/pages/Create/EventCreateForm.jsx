// src/pages/Create/EventCreateForm.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import Button from "../../components/ui/Button";
import { useAuth } from "../../auth/useAuth";
import styles from "./EventCreateForm.module.css";
import { draftFileStore } from "./draftFileStore";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "./cropUtils";
import Autocomplete from "react-google-autocomplete";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

function toast(msg) {
  const div = document.createElement("div");
  div.className = styles.toast;
  div.innerText = msg;

  document.body.appendChild(div);

  setTimeout(() => div.classList.add(styles.toastShow), 10);
  setTimeout(() => {
    div.classList.remove(styles.toastShow);
    setTimeout(() => div.remove(), 250);
  }, 2300);
}

function toDatetimeLocal(value) {
  if (!value) return "";

  // já está no formato certo
  if (typeof value === "string" && value.includes("T")) {
    return value.slice(0, 16);
  }

  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}


export default function EventCreateForm() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.isLoading ?? auth?.loading ?? false;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [category, setCategory] = useState("party");
  const [locationField, setLocationField] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [price, setPrice] = useState("");

  const [, setFile] = useState(null); // Used to trigger rerender if needed, but primarily saved in draftFileStore
  const [previewUrl, setPreviewUrl] = useState(null);

  // Cropper states
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);


  useEffect(() => {
  let source = state;

  if (!source) {
    try {
      const raw = sessionStorage.getItem("vg_create_event_draft");
      if (raw) source = JSON.parse(raw);
    } catch {
      // ignore JSON parse error
    }
  }

  if (!source) return;

  setTitle(source.title || "");
  setDescription(source.description || "");
  if (source.event_date) {
  setEventDate(toDatetimeLocal(source.event_date));
}else {
  const now = new Date();
  const formatted =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0") +
    "T" +
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0");

  setEventDate(formatted);
}

  setCategory(source.category || "party");
  setLocationField(source.location || "");
  setOnlineUrl(source.online_url || "");
  setPrice(source.price || "");
  setPreviewUrl(source.image_url || null);
}, [state]);




  const editorSynced = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: "",
    onUpdate({ editor }) {
      setDescription(editor.getHTML());
    },
  });

  // Sync description into TipTap once — works regardless of which arrives first
  useEffect(() => {
    if (!editor || editorSynced.current || !description) return;
    editorSynced.current = true;
    editor.commands.setContent(description);
  }, [editor, description]);

  async function resizeAndCompressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const MAX_SIZE = 1600; // px
      let { width, height } = img;

      if (width > height && width > MAX_SIZE) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          resolve(
            new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.8 // compressão (0.7–0.85 é o sweet spot)
      );
    };

    reader.readAsDataURL(file);
  });
}


  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  async function handleCropSave() {
    if (!imageToCrop || !croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const optimized = await resizeAndCompressImage(croppedImage);

      draftFileStore.set(optimized);
      setFile(optimized);
      setPreviewUrl(URL.createObjectURL(optimized));

      setIsCropping(false);

      if (imageToCrop) URL.revokeObjectURL(imageToCrop);
      setImageToCrop(null);
    } catch (e) {
      console.error(e);
      toast("Error cropping image");
    }
  }

  function handleCropCancel() {
    setIsCropping(false);

    if (imageToCrop) URL.revokeObjectURL(imageToCrop);
    setImageToCrop(null);
  }

  async function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // We don't optimize here yet, we optimize after cropping
    const objectUrl = URL.createObjectURL(selected);
    setImageToCrop(objectUrl);
    setIsCropping(true);

    e.target.value = ""; // Reset the input so the same file can be selected again
  }


  const storedDraft = (() => {
  try {
    const raw = sessionStorage.getItem("vg_create_event_draft");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const resolvedIsPublic =
  state?.is_public ??
  storedDraft?.is_public ??
  true; // fallback seguro

  const resolvedEventFormat =
  state?.event_format ??
  storedDraft?.event_format ??
  "in_person"; // fallback seguro

  const resolvedIsPaid =
  state?.is_paid ??
  storedDraft?.is_paid ??
  false; // fallback seguro (gratuito só se nunca foi pago)


  function goToReview() {
    if (authLoading) return toast("Loading session… try again.");
    if (!user?.id) {
      toast("You must be logged in to create an event.");
      navigate("/login", { replace: true });
      return;
    }
    if (!title.trim()) return toast("Title is required.");
    if (!eventDate) return toast("Date is required.");
    if (resolvedEventFormat === "in_person" && !locationField.trim())
      return toast("Address is required.");
    if (resolvedEventFormat === "online" && !onlineUrl.trim())
      return toast("Online URL is required.");
    if (resolvedIsPaid && (!price || Number(price) <= 0))
      return toast("Enter a valid price.");

    const draft = {
      event_id: state?.event_id ?? null,
      title,
      description,
      event_date: eventDate,
      category,
      location: locationField,
      online_url: onlineUrl,
      price: resolvedIsPaid ? price : null,
      is_paid: resolvedIsPaid,
      is_public: resolvedIsPublic,
      event_format: resolvedEventFormat,
      // blob: URL stays valid for the lifetime of this SPA tab session
      // actual upload happens in ReviewEvent.publish()
      image_url: previewUrl || "",
    };
    sessionStorage.setItem("vg_create_event_draft", JSON.stringify(draft));

    navigate("/create/review", {
      state: { ...draft, fromReview: true },
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>Criar evento</div>
        <div className={styles.processStep}>Passo 4 de 5 · Detalhes</div>
      </div>

      <h2 className={styles.title}>Detalhes do evento</h2>

      <div className={styles.card}>
        <input
          className={styles.input}
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      

      {/* 🔽 ÚNICA TROCA VISUAL/FUNCIONAL */}
      <div className={styles.card}>
        <EditorContent
          editor={editor}
          className={styles.descriptionInput}
        />
      </div>
      {/* 🔼 */}

      <div className={styles.card}>
        <input
          className={styles.input}
          type="datetime-local"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      <div className={styles.card}>
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="party">Festa</option>
          <option value="show">Show</option>
          <option value="teather">Teatro</option>
          <option value="birthday">Aniversário</option>
          <option value="class">Aulas-Cursos</option>
          <option value="workshop">workshop</option>
          <option value="sport">Esporte</option>
          <option value="art">Arte</option>
          <option value="culture">Cultura</option>
        </select>
      </div>

      {state?.event_format === "in_person" && (
        <div className={styles.card}>
          <Autocomplete
            className={styles.input}
            apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
            options={{
              types: ["establishment", "geocode"],
            }}
            placeholder="Nome ou Endereço do local"
            onPlaceSelected={(place) => {
              if (place && place.name && place.formatted_address) {
                // If the user selects a specific venue, use its name and address
                const combined = place.name !== place.formatted_address.split(",")[0]
                  ? `${place.name}, ${place.formatted_address}`
                  : place.formatted_address;
                setLocationField(combined);
              } else if (place && place.formatted_address) {
                setLocationField(place.formatted_address);
              } else {
                setLocationField(place?.name || "");
              }
            }}
            onChange={(e) => setLocationField(e.target.value)}
            defaultValue={locationField}
          />
        </div>
      )}

      {state?.event_format === "online" && (
        <div className={styles.card}>
          <input
            className={styles.input}
            placeholder="URL da transmissão"
            value={onlineUrl}
            onChange={(e) => setOnlineUrl(e.target.value)}
          />
        </div>
      )}

      {(state?.is_paid ?? JSON.parse(sessionStorage.getItem("vg_create_event_draft"))?.is_paid) && (

        <div className={styles.card}>
          <input
            className={styles.input}
            type="number"
            placeholder="Preço"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      )}

      <div className={styles.card}>
        <label className={styles.fileLabel}>
          {previewUrl ? (
            <img src={previewUrl} className={styles.preview} alt="preview" />
          ) : (
            "Escolha uma imagem de capa"
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
        </label>
      </div>

      <Button onClick={goToReview}>
        Review Event →
      </Button>

      {isCropping && (
        <div className={styles.cropperOverlay}>
          <div className={styles.cropperContainer}>
            <div className={styles.cropperInner}>
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className={styles.cropperControls}>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => {
                  setZoom(e.target.value);
                }}
                className={styles.zoomSlider}
              />
              <div className={styles.cropperButtons}>
                <Button onClick={handleCropCancel} className={styles.cancelBtn}>Cancel</Button>
                <Button onClick={handleCropSave}>Save Crop</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
