/**
 * PhotoCropPicker
 * ─────────────────────────────────────────────────────────────
 * Three modes:
 *   "pick"   → dashed area, click to choose file
 *   "crop"   → image is shown at a scaled size that covers the
 *              container; user drags to reposition the best part;
 *              subtle rule-of-thirds grid overlay for guidance
 *   "done"   → shows the cropped JPEG thumbnail + "Recrop / Change" buttons
 *
 * Props:
 *   onCrop(blob, url)        – called when the user confirms the crop
 *   onPendingChange(pending) – called with true when a file is picked
 *                              (crop not yet confirmed), false when confirmed
 *                              or cleared. Parent can use this to block
 *                              navigation until the user confirms.
 */
import { useState, useRef, useEffect } from "react";
import styles from "./PhotoCropPicker.module.css";

const MAX_OUT_PX = 1200; // max width of the exported JPEG

export default function PhotoCropPicker({ onCrop, onPendingChange }) {
  // ── state ──────────────────────────────────────────────────
  const [imgSrc,      setImgSrc]      = useState(null); // raw objectURL
  const [imgW,        setImgW]        = useState(0);    // displayed px
  const [imgH,        setImgH]        = useState(0);
  const [pos,         setPos]         = useState({ x: 0, y: 0 }); // top-left of img inside cropArea
  const [dragging,    setDragging]    = useState(false);
  const [croppedUrl,  setCroppedUrl]  = useState(null); // result after "Use this"

  // ── refs (not state → no extra renders, always fresh inside effects) ──
  const containerRef   = useRef(null);
  const imgRef         = useRef(null);
  const scaleRef       = useRef(1);              // naturalPx → displayedPx
  const natRef         = useRef({ w: 0, h: 0 }); // natural image size
  const displayRef     = useRef({ w: 0, h: 0 }); // displayed image size
  const dragStart      = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const originalFileRef = useRef(null);          // raw File — fallback if canvas.toBlob fails

  // ── helpers ────────────────────────────────────────────────
  function loadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    originalFileRef.current = file;             // save original for canvas.toBlob fallback
    onPendingChange?.(true);                    // notify parent: crop not yet confirmed
    const url = URL.createObjectURL(file);
    setImgSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    setCroppedUrl(null);
    setPos({ x: 0, y: 0 });
    setImgW(0);
    setImgH(0);
  }

  function handleImgLoad() {
    const img = imgRef.current;
    const c   = containerRef.current;
    if (!img || !c) return;

    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    natRef.current = { w: nw, h: nh };

    // Scale image to COVER the container (like object-fit: cover)
    const s = Math.max(cw / nw, ch / nh);
    scaleRef.current = s;

    const dw = Math.round(nw * s);
    const dh = Math.round(nh * s);
    displayRef.current = { w: dw, h: dh };
    setImgW(dw);
    setImgH(dh);

    // Center
    setPos({
      x: Math.round((cw - dw) / 2),
      y: Math.round((ch - dh) / 2),
    });
  }

  // Clamp so the image always covers the container
  function clamp(px, py) {
    const c = containerRef.current;
    if (!c) return { x: px, y: py };
    const { w: dw, h: dh } = displayRef.current;
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    return {
      x: Math.min(0, Math.max(cw - dw, px)),
      y: Math.min(0, Math.max(ch - dh, py)),
    };
  }

  // ── drag handling ──────────────────────────────────────────
  function startDrag(clientX, clientY) {
    dragStart.current = { cx: clientX, cy: clientY, px: pos.x, py: pos.y };
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;

    function onMove(e) {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - dragStart.current.cx;
      const dy = cy - dragStart.current.cy;
      setPos(clamp(dragStart.current.px + dx, dragStart.current.py + dy));
    }
    function onUp() { setDragging(false); }

    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("touchmove",  onMove, { passive: false });
    window.addEventListener("touchend",   onUp);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // ── export ─────────────────────────────────────────────────
  async function handleCrop() {
    const c = containerRef.current;
    if (!c || !imgSrc) return;

    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    const s  = scaleRef.current;

    // Visible region in natural image coordinates
    const natX = Math.round(Math.max(0, -pos.x) / s);
    const natY = Math.round(Math.max(0, -pos.y) / s);
    const natW = Math.round(cw / s);
    const natH = Math.round(ch / s);

    // Cap output width at MAX_OUT_PX (maintains aspect ratio)
    const outScale = Math.min(1, MAX_OUT_PX / natW);
    const outW = Math.round(natW * outScale);
    const outH = Math.round(natH * outScale);

    const canvas = document.createElement("canvas");
    canvas.width  = outW;
    canvas.height = outH;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgSrc;
    await new Promise((r) => { img.onload = r; img.onerror = r; if (img.complete) r(); });

    canvas.getContext("2d").drawImage(img, natX, natY, natW, natH, 0, 0, outW, outH);

    canvas.toBlob((blob) => {
      // canvas.toBlob() can return null on some mobile browsers (iOS Safari).
      // Fall back to the original File so the user never loses their image silently.
      const finalBlob = blob || originalFileRef.current;
      if (!finalBlob) {
        console.warn("[PhotoCropPicker] canvas.toBlob returned null and no fallback file");
        return;
      }
      const url = URL.createObjectURL(finalBlob);
      setCroppedUrl(url);
      onPendingChange?.(false);   // crop confirmed — unblock navigation
      onCrop(finalBlob, url);
    }, "image/jpeg", 0.85);
  }

  // ── render: pick mode ──────────────────────────────────────
  if (!imgSrc) {
    return (
      <label className={styles.pickLabel}>
        <span className={styles.pickIcon}>🖼️</span>
        <span className={styles.pickText}>Choose a cover image</span>
        <input type="file" accept="image/*" onChange={loadFile} className={styles.hidden} />
      </label>
    );
  }

  // ── render: done / preview mode ────────────────────────────
  if (croppedUrl) {
    return (
      <div className={styles.doneWrap}>
        <div className={styles.previewWrap}>
          <img src={croppedUrl} className={styles.previewImg} alt="cover preview" />
          <div className={styles.previewBadge}>✓ Cover set</div>
        </div>
        <div className={styles.doneActions}>
          <button type="button" className={styles.recropBtn} onClick={() => setCroppedUrl(null)}>
            ✎ Recrop
          </button>
          <label className={styles.changeBtn}>
            Change photo
            <input type="file" accept="image/*" onChange={loadFile} className={styles.hidden} />
          </label>
        </div>
      </div>
    );
  }

  // ── render: crop mode ──────────────────────────────────────
  return (
    <div className={styles.cropWrap}>
      <div
        ref={containerRef}
        className={styles.cropArea}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <img
          ref={imgRef}
          src={imgSrc}
          crossOrigin="anonymous"
          draggable={false}
          alt=""
          onLoad={handleImgLoad}
          onError={() => setImgSrc(null)}
          className={styles.cropImg}
          style={{
            width:  imgW > 0 ? imgW : "auto",
            height: imgH > 0 ? imgH : "auto",
            left:   pos.x,
            top:    pos.y,
          }}
        />
        {/* Rule-of-thirds guide overlay */}
        <div className={styles.gridOverlay} aria-hidden="true" />
      </div>

      <div className={styles.cropActions}>
        <label className={styles.changeBtn}>
          Change
          <input type="file" accept="image/*" onChange={loadFile} className={styles.hidden} />
        </label>
        <button type="button" className={styles.useCropBtn} onClick={handleCrop}>
          ✓ Use this
        </button>
      </div>

      <p className={styles.cropHint}>Drag to reposition · best area becomes the cover</p>
    </div>
  );
}
