import { useEffect, useMemo, useRef, useState } from 'react';
import { Aperture, ArrowDownToLine, Camera, CameraOff, Check, ChevronDown, CircleHelp, FlipHorizontal2, Heart, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, SwitchCamera, Upload, WandSparkles, X } from 'lucide-react';
import { Dialog } from './components/Dialog';
import { Settings } from './components/Settings';
import { PhotoTray } from './components/PhotoTray';
import { useCamera } from './hooks/useCamera';
import { useCapture } from './hooks/useCapture';
import { defaultEdit, filters, type EditRecipe } from './lib/filters';
import { captureImage, composeFrame, downloadName, pngBlob, readUpload } from './lib/images';
import { layouts, type FrameOptions, type LayoutId, type Photo } from './lib/layouts';
import { FilterEditor } from './components/editor/FilterEditor';
import { CameraPreview } from './components/editor/CameraPreview';
import { ResultViewer, type ResultData } from './components/ResultViewer';
import { useShutter } from './hooks/useShutter';
import { navigate, useRoute } from './hooks/useRoute';
import { MemoryWall } from './pages/MemoryWall';
import { clearImageCache } from './lib/renderPhoto';

export default function App() {
  const camera = useCamera();
  const capture = useCapture();
  const shutter = useShutter();
  const route = useRoute();
  const [wallPhotoId, setWallPhotoId] = useState<string | undefined>();
  const [layoutId, setLayoutId] = useState<LayoutId>('strip4');
  const layout = layouts.find(item => item.id === layoutId)!;
  const [photos, setPhotos] = useState<(Photo | null)[]>(Array(6).fill(null));
  const [options, setOptions] = useState<FrameOptions>({ frame: 'pastel', color: '#ffe4ee', caption: '', showDate: true, date: new Date() });
  const [edit, setEdit] = useState<EditRecipe>({ ...defaultEdit });
  const [before, setBefore] = useState(false);
  const [effects, setEffects] = useState(true);
  const [sound, setSound] = useState(false);
  const [timer, setTimer] = useState('3');
  const [customTimer, setCustomTimer] = useState(3);
  const [mirror, setMirror] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [help, setHelp] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<number | null>(null);
  const asyncLock = useRef(false);
  const mounted = useRef(true);
  const currentPhotos = useMemo(() => photos.slice(0, layout.count), [photos, layout.count]);
  const count = currentPhotos.filter(Boolean).length;
  const currentEdit = selected !== null && photos[selected] ? photos[selected]!.edit : edit;
  const filter = filters.find(f => f.id === currentEdit.filterId)!;
  const locked = capture.busy || uploading || exporting;
  const ready = camera.status === 'ready';
  const target = selected ?? currentPhotos.findIndex(p => !p);
  const canCapture = ready && !locked && target >= 0;
  const seconds = timer === 'custom' ? customTimer : Number(timer);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!ready) capture.cancel(); }, [ready, capture.cancel]);
  useEffect(() => { if (result) return () => URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => { if (route === '/memory-wall') { camera.stop(); capture.cancel(); } }, [route, camera.stop, capture.cancel]);
  useEffect(() => () => clearImageCache(), []);

  function changeEdit(next: EditRecipe) {
    setEdit(next);
    if (selected !== null && photos[selected]) setPhotos(previous => previous.map((p, i) => p && i === selected ? { ...p, edit: { ...next } } : p));
  }
  function openWall(id?: string) { setWallPhotoId(id); setResult(null); navigate('/memory-wall'); }

  function report(err: unknown) { setError(err instanceof Error ? err.message : 'Có lỗi xảy ra. Hãy thử lại nhé.'); }
  function updateOptions(value: Partial<FrameOptions>) { setOptions(previous => ({ ...previous, ...value })); }
  function changeLayout(id: LayoutId) {
    setLayoutId(id); setSelected(null);
    if (photos.some(Boolean)) setNotice('Đã đổi bố cục và giữ ảnh hiện có. Ảnh dư được giữ lại khi bạn quay về bố cục lớn hơn.');
  }
  function startCapture(auto = false, explicitSlot?: number) {
    if (!ready || locked || asyncLock.current) return;
    const slots = explicitSlot !== undefined ? [explicitSlot] : auto ? currentPhotos.flatMap((p, i) => p ? [] : [i]) : target >= 0 ? [target] : [];
    setError(''); setNotice('');
    if (sound) shutter.prepare();
    void capture.run(slots, seconds, slot => {
      if (!camera.videoRef.current || camera.videoRef.current.readyState < 2) throw new Error('Camera chưa sẵn sàng. Hãy bật lại camera.');
      const originalSrc = captureImage(camera.videoRef.current, 'normal', mirror);
      setPhotos(previous => previous.map((photo, i) => i === slot ? { id: crypto.randomUUID(), originalSrc, origin: 'camera', edit: { ...currentEdit } } : photo));
      if (sound) shutter.play();
      setSelected(null);
    }, report);
  }
  function chooseUpload(slot: number | null = null) {
    if (locked) return;
    uploadTarget.current = slot;
    if (uploadRef.current) { uploadRef.current.value = ''; uploadRef.current.click(); }
  }
  async function handleUpload(files: FileList | null) {
    if (!files?.length || locked || asyncLock.current) return;
    asyncLock.current = true; setUploading(true); setError(''); setNotice('');
    const explicit = uploadTarget.current;
    const slots = explicit !== null ? [explicit] : selected !== null ? [selected, ...currentPhotos.flatMap((p, i) => !p && i !== selected ? [i] : [])] : currentPhotos.flatMap((p, i) => p ? [] : [i]);
    try {
      if (!slots.length) throw new Error('Bộ ảnh đã đủ. Hãy chọn một ô ảnh để thay thế.');
      const chosen = Array.from(files).slice(0, slots.length);
      // Validate and decode every chosen file before updating the session.
      const additions: Photo[] = [];
      for (const file of chosen) additions.push({ id: crypto.randomUUID(), originalSrc: await readUpload(file), origin: 'upload', edit: { ...currentEdit } });
      if (!mounted.current) return;
      setPhotos(previous => { const next = [...previous]; additions.forEach((photo, i) => { next[slots[i]] = photo; }); return next; });
      setSelected(null);
      setNotice(files.length > slots.length ? `Đã thêm ${additions.length} ảnh. Những tệp vượt số ô trống không được thêm.` : `Đã thêm ${additions.length} ảnh với bộ lọc ${filter.name.toLowerCase()}.`);
    } catch (err) { if (mounted.current) report(err); }
    finally { asyncLock.current = false; if (mounted.current) setUploading(false); }
  }
  async function showResult() {
    if (count !== layout.count || locked || asyncLock.current) return;
    asyncLock.current = true; setExporting(true); setError('');
    camera.stop();
    try {
      const canvas = await composeFrame(layout, currentPhotos, options);
      const blob = await pngBlob(canvas);
      if (!mounted.current) return;
      setResult({ url: URL.createObjectURL(blob), blob, name: downloadName(new Date()), width: canvas.width, height: canvas.height });
    } catch (err) { report(err); }
    finally { asyncLock.current = false; if (mounted.current) setExporting(false); }
  }
  function reset() {
    capture.cancel(); setPhotos(Array(6).fill(null)); setSelected(null); setResult(null); setError(''); setNotice('Một bộ ảnh mới, một chút kỷ niệm mới.'); updateOptions({ date: new Date() });
    clearImageCache();
  }

  if (route === '/memory-wall') return <MemoryWall onBooth={() => navigate('/')} initialPhotoId={wallPhotoId} />;

  return <div data-effects={effects ? 'on' : 'off'}>
    <header className="site-header"><div className="header-inner">
      <a href="#" className="brand" aria-label="PhotoBeo — trang chụp ảnh"><span className="brand-mark"><Camera size={24} strokeWidth={1.5} /><Heart size={9} fill="currentColor" /></span><span>PhotoBeo<span className="brand-spark">✧</span></span></a>
      <nav><span className="nav-link active">Góc chụp</span><button className="nav-link" disabled={locked} onClick={() => openWall()}><Heart size={15} />Góc kỷ niệm</button></nav>
      <button className="help-button" aria-label="Cách chụp" onClick={() => setHelp(true)}><CircleHelp size={17} /><span>Cách chụp</span></button>
    </div></header>
    <main>
      <section className="intro"><div className="eyebrow"><span /> GÓC PHOTOBOOTH NHỎ CỦA BẠN <span /></div><h1>Một chút <em>xinh.</em> Một chút <em>nhớ.</em><Sparkles className="intro-spark" size={25} strokeWidth={1.3} /></h1><p>Cứ cười thật tươi, phần còn lại để PhotoBeo nhé!</p>
        <div className="steps" aria-label="Các bước chụp ảnh"><span className="active"><b>1</b> Chọn gu của bạn</span><i /><span className={count > 0 || ready ? 'active' : ''}><b>2</b> Cười lên & chụp</span><i /><span className={count === layout.count ? 'active' : ''}><b>3</b> Mang kỷ niệm về</span></div>
      </section>
      <div className="workspace">
        <Settings disabled={locked} layout={layout} onLayout={changeLayout} options={options} onOptions={updateOptions} timer={timer} onTimer={setTimer} customTimer={customTimer} onCustomTimer={setCustomTimer} />
        <section className="studio" aria-label="Góc chụp ảnh">
          <div className="studio-topline"><div><span className={`status-dot ${ready ? 'live' : ''}`} /><span>{capture.busy ? capture.remaining !== null ? 'Sẵn sàng tạo dáng nhé' : 'Đang lưu khoảnh khắc' : ready ? 'Camera đã sẵn sàng' : 'Góc chụp của bạn'}</span></div><span className="format-label">{layout.name} <span>·</span> {layout.count} ảnh</span></div>
          <div className={`camera-stage ${ready ? 'is-live' : ''}`}>
            <video ref={camera.videoRef} autoPlay playsInline muted onCanPlay={camera.ready} onLoadedData={camera.ready} aria-label="Hình ảnh trực tiếp từ camera" style={{ opacity: 0 }} />
            {ready && <CameraPreview videoRef={camera.videoRef} edit={currentEdit} mirror={mirror} before={before} />}
            {!ready && <div className="camera-placeholder"><div className="floating-star star-one">✧</div><div className="floating-star star-two">✦</div><div className="camera-illustration"><Camera size={48} strokeWidth={1.15} /><span>♡</span></div><h2>Một nụ cười, một kỷ niệm</h2><p>Bật camera, chọn góc xinh nhất<br />và lưu lại phiên bản hôm nay của bạn.</p><button className="primary camera-enable" onClick={() => void camera.start()} disabled={camera.status === 'loading' || locked}>{camera.status === 'loading' ? <LoaderCircle className="spin" size={17} /> : <Camera size={17} />}{camera.status === 'loading' ? 'Đang kết nối…' : 'Bật camera'}</button><span className="permission-note"><LockKeyhole size={12} /> Chỉ bạn nhìn thấy hình ảnh của mình</span>{camera.status === 'loading' && <button className="text-button" onClick={camera.stop}>Hủy kết nối</button>}</div>}
            <div className="viewfinder corner-tl" /><div className="viewfinder corner-tr" /><div className="viewfinder corner-bl" /><div className="viewfinder corner-br" />
            {ready && <div className="camera-tools"><button className={`glass-button ${mirror ? 'active' : ''}`} onClick={() => setMirror(v => !v)} disabled={locked} aria-label="Lật gương" aria-pressed={mirror} title="Lật gương"><FlipHorizontal2 size={19} /></button><div><button className="glass-button" onClick={() => void camera.start(undefined, camera.facing === 'user' ? 'environment' : 'user')} disabled={locked} aria-label="Chuyển camera trước hoặc sau" title="Chuyển camera"><SwitchCamera size={19} /></button><button className="glass-button" onClick={camera.stop} disabled={locked} aria-label="Tắt camera" title="Tắt camera"><CameraOff size={18} /></button></div></div>}
            {capture.remaining !== null && <div className="countdown" role="status" aria-label={`Còn ${capture.remaining} giây`} key={capture.remaining}>{capture.remaining}</div>}
            {capture.flash && effects && <div className="camera-flash" />}
            <div className="capture-progress" aria-live="polite"><span className={count === layout.count ? 'complete-dot' : ''} />Đã chụp {count}/{layout.count}</div>
          </div>
          {camera.error && <div role="alert" className="message error-message"><CameraOff size={17} /><span>{camera.error}</span></div>}
          {camera.devices.length > 1 && <div className="camera-selector"><Camera size={14} /><select aria-label="Thiết bị camera" disabled={locked || camera.status === 'loading'} value={camera.deviceId} onChange={e => void camera.start(e.target.value, camera.facing)}>{camera.devices.map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${i + 1}`}</option>)}</select><ChevronDown size={14} /></div>}
          <div className="capture-controls"><button className="secondary-shot" onClick={() => startCapture(false)} disabled={!canCapture}><span><Camera size={22} /></span>{selected !== null && photos[selected] ? 'Chụp lại ảnh' : 'Chụp từng ảnh'}</button><button className="auto-shot" onClick={() => startCapture(true)} disabled={!ready || locked || count === layout.count} aria-label="Chụp tự động"><span><Aperture size={36} strokeWidth={1.5} /></span><b>Chụp tự động</b></button><button className="secondary-shot reset-shot" onClick={reset} disabled={locked || !photos.some(Boolean)}><span><RotateCcw size={22} /></span>Chụp lại tất cả</button></div>
          {capture.busy ? <button className="cancel-button" onClick={capture.cancel}><X size={16} />Hủy chụp</button> : <p className="capture-hint">{selected !== null ? `Đã chọn ô ${selected + 1}. Chụp hoặc tải ảnh để thay thế.` : count === layout.count ? 'Đủ bộ rồi! Xem thành phẩm hoặc chọn một ảnh để chụp lại.' : 'Thả lỏng vai, nghiêng đầu nhẹ… và cười thôi ♡'}</p>}
          <div className="capture-preferences"><label><input type="checkbox" checked={sound} disabled={locked} onChange={e => { setSound(e.target.checked); if (e.target.checked) shutter.prepare(); }} />Âm thanh chụp</label><label><input type="checkbox" checked={effects} onChange={e => setEffects(e.target.checked)} />Hiệu ứng dịu nhẹ</label></div>
          <div className="upload-divider"><span /><button disabled={locked} onClick={() => chooseUpload()}><Upload size={16} />{uploading ? 'Đang xử lý ảnh…' : 'Tải ảnh từ thiết bị'}</button><span /></div>
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="Chọn tệp ảnh" onChange={e => void handleUpload(e.target.files)} />
          {(notice || error) && <div className={`message ${error ? 'error-message' : ''}`} role={error ? 'alert' : 'status'}><span>{error || notice}</span><button aria-label="Ẩn thông báo" onClick={() => { setError(''); setNotice(''); }}><X size={15} /></button></div>}
          <FilterEditor edit={currentEdit} onChange={changeEdit} disabled={locked} originalSrc={selected !== null ? photos[selected]?.originalSrc : ready ? undefined : currentPhotos.find(p => p)?.originalSrc} selected={selected} before={before} onBefore={setBefore} hasPhotos={count > 0} onApplyAll={() => { setPhotos(previous => previous.map(p => p ? { ...p, edit: { ...currentEdit } } : p)); setNotice('Đã áp dụng công thức màu từ ảnh gốc cho cả bộ ảnh.'); }} videoRef={camera.videoRef} cameraReady={ready} mirror={mirror} />
          <div className="privacy-note"><ShieldCheck size={16} /><span>Chụp và chỉnh ảnh trên máy. Chỉ gửi ảnh khi bạn đồng ý lưu vào Góc kỷ niệm.</span></div>
        </section>
        <PhotoTray layout={layout} photos={currentPhotos} options={options} selected={selected} disabled={locked} cameraReady={ready} onSelect={i => { setSelected(v => v === i ? null : i); setBefore(false); }} onUpload={chooseUpload} onRetake={i => startCapture(false, i)} onResult={() => void showResult()} exporting={exporting} effects={effects} />
      </div>
      <div className="bottom-message"><span>✧</span> Những điều bình thường, khi được lưu lại, đều trở nên đặc biệt. <span>✧</span></div>
    </main>
    <footer><span className="footer-logo">PhotoBeo</span><span>Một góc nhỏ, thật nhiều kỷ niệm.</span><span>Được làm với <Heart size={12} fill="currentColor" /></span></footer>
    {help && <Dialog title="Một bộ ảnh xinh trong 3 bước" onClose={() => setHelp(false)}><ol className="help-steps"><li><b>Chọn gu của bạn</b><p>Chọn bố cục, kiểu khung, màu và một lời nhắn nhỏ.</p></li><li><b>Cười lên & chụp</b><p>Bật camera và cho phép truy cập. Chọn bộ lọc, thời gian đếm ngược, rồi chụp từng ảnh hoặc tự động. Bạn cũng có thể tải JPEG, PNG, WebP dưới 15 MB.</p></li><li><b>Mang kỷ niệm về</b><p>Chọn từng ô để thay ảnh hoặc chụp lại. Khi đủ ảnh, nhấn “Xem thành phẩm” và tải PNG chất lượng cao.</p></li></ol><div className="help-tip"><ShieldCheck size={20} /><p>Camera cần HTTPS hoặc localhost. Ảnh chỉ lưu trong phiên trình duyệt; hãy tải thành phẩm trước khi đóng hoặc tải lại trang.</p></div><button className="primary" onClick={() => setHelp(false)}>Bắt đầu tạo kỷ niệm <Heart size={16} /></button></Dialog>}
    {result && <ResultViewer result={result} photos={currentPhotos as Photo[]} layoutId={layoutId} options={options} effects={effects} onClose={() => setResult(null)} onReset={reset} onWall={openWall} />}
  </div>;
}
