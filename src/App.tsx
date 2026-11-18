import { useEffect, useMemo, useRef, useState } from 'react';
import { Aperture, ArrowDownToLine, Camera, CameraOff, Check, ChevronDown, CircleHelp, FlipHorizontal2, Heart, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, SwitchCamera, Upload, WandSparkles, X } from 'lucide-react';
import { Dialog } from './components/Dialog';
import { Settings } from './components/Settings';
import { FramePreview } from './components/FramePreview';
import { EditedPhoto } from './components/editor/EditedPhoto';
import { PhotoHistory } from './pages/PhotoHistory';
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
  const [step, setStep] = useState(1);
  const [batchSize, setBatchSize] = useState(4);
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
  const total = photos.filter(Boolean).length;
  const currentEdit = selected !== null && photos[selected] ? photos[selected]!.edit : edit;
  const filter = filters.find(f => f.id === currentEdit.filterId)!;
  const locked = capture.busy || uploading || exporting;
  const ready = camera.status === 'ready';
  const target = selected ?? photos.findIndex(p => !p);
  const canCapture = ready && !locked && target >= 0;
  const seconds = timer === 'custom' ? customTimer : Number(timer);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!ready) capture.cancel(); }, [ready, capture.cancel]);
  useEffect(() => { if (result) return () => URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => { if (route !== '/' || step !== 1) { camera.stop(); capture.cancel(); } }, [route, step, camera.stop, capture.cancel]);
  useEffect(() => () => clearImageCache(), []);

  function changeEdit(next: EditRecipe) {
    setEdit(next);
    if (selected !== null && photos[selected]) setPhotos(previous => previous.map((p, i) => p && i === selected ? { ...p, edit: { ...next } } : p));
  }
  function openWall(id?: string) { setWallPhotoId(id); navigate('/memory-wall'); }

  function report(err: unknown) { setError(err instanceof Error ? err.message : 'Có lỗi xảy ra. Hãy thử lại nhé.'); }
  function updateOptions(value: Partial<FrameOptions>) { setOptions(previous => ({ ...previous, ...value })); }
  function changeLayout(id: LayoutId) {
    setLayoutId(id); setSelected(null);
    if (photos.some(Boolean)) setNotice('Đã đổi bố cục và giữ ảnh hiện có. Ảnh dư được giữ lại khi bạn quay về bố cục lớn hơn.');
  }
  function startCapture(auto = false, explicitSlot?: number) {
    if (!ready || locked || asyncLock.current) return;
    const slots = explicitSlot !== undefined ? [explicitSlot] : auto ? photos.flatMap((p, i) => p ? [] : [i]).slice(0, batchSize) : target >= 0 ? [target] : [];
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
    const slots = explicit !== null ? [explicit] : selected !== null ? [selected, ...photos.flatMap((p, i) => !p && i !== selected ? [i] : [])] : photos.flatMap((p, i) => p ? [] : [i]);
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
      setStep(4);
      setResult({ url: URL.createObjectURL(blob), blob, name: downloadName(new Date()), width: canvas.width, height: canvas.height });
    } catch (err) { report(err); }
    finally { asyncLock.current = false; if (mounted.current) setExporting(false); }
  }
  function reset() {
    capture.cancel(); setStep(1); setPhotos(Array(6).fill(null)); setSelected(null); setResult(null); setError(''); setNotice('Một bộ ảnh mới, một chút kỷ niệm mới.'); updateOptions({ date: new Date() });
    clearImageCache();
  }

  if (route === '/history') return <PhotoHistory onBooth={() => navigate('/')} onWall={openWall} />;
  if (route === '/memory-wall') return <MemoryWall onBooth={() => navigate('/')} initialPhotoId={wallPhotoId} />;

  return <div data-effects={effects ? 'on' : 'off'}>
    <header className="site-header"><div className="header-inner">
      <a href="#" className="brand" aria-label="PhotoBeo — trang chụp ảnh"><span className="brand-mark"><Camera size={24} strokeWidth={1.5} /><Heart size={9} fill="currentColor" /></span><span>PhotoBeo<span className="brand-spark">✧</span></span></a>
      <nav><span className="nav-link active">Góc chụp</span><button className="nav-link" disabled={locked} onClick={() => navigate('/history')}>Lịch sử ảnh</button><button className="nav-link" disabled={locked} onClick={() => openWall()}><Heart size={15} />Góc kỷ niệm</button></nav>
      <button className="help-button" aria-label="Cách chụp" onClick={() => setHelp(true)}><CircleHelp size={17} /><span>Cách chụp</span></button>
    </div></header>
    <main>
      <section className="intro"><div className="eyebrow"><span /> GÓC PHOTOBOOTH NHỎ CỦA BẠN <span /></div><h1>Một chút <em>xinh.</em> Một chút <em>nhớ.</em><Sparkles className="intro-spark" size={25} strokeWidth={1.3} /></h1><p>Cứ cười thật tươi, phần còn lại để PhotoBeo nhé!</p>
        <div className="wizard-progress" aria-label={`Bước ${step}/4`}>{['Chụp ảnh', 'Chọn mẫu', 'Chỉnh sửa', 'Thành phẩm'].map((name, i) => <div key={name} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''} aria-current={step === i + 1 ? 'step' : undefined}><b>{step > i + 1 ? '✓' : i + 1}</b><span>{name}</span></div>)}</div>
        <p className="step-caption">{step}/4 · {['Chụp trước, chọn mẫu sau. Tối đa 6 khoảnh khắc trong một bộ.', 'Tìm chiếc khung hợp với câu chuyện của bạn.', 'Chọn một ảnh, thử một màu. Ảnh gốc luôn được giữ lại.', 'Thành phẩm đã sẵn sàng. Bạn quyết định nơi lưu giữ.'][step - 1]}</p>
      </section>
      <div className={`wizard-workspace step-${step}`}>
        {step === 2 && <Settings disabled={locked} layout={layout} onLayout={changeLayout} options={options} onOptions={updateOptions} timer={timer} onTimer={setTimer} customTimer={customTimer} onCustomTimer={setCustomTimer} />}
        {step === 1 && <section className="studio" aria-label="Góc chụp ảnh">
          <div className="capture-setup"><label>Đếm ngược<select aria-label="Thời gian đếm ngược" value={timer} disabled={locked} onChange={e => setTimer(e.target.value)}><option value="0">Không đếm ngược</option><option value="3">3 giây</option><option value="5">5 giây</option><option value="10">10 giây</option><option value="custom">Tùy chỉnh</option></select></label>{timer === 'custom' && <label>Số giây<input type="number" min="1" max="15" value={customTimer} onChange={e => setCustomTimer(Math.max(1, Math.min(15, +e.target.value || 1)))} /></label>}<label>Chụp liên tiếp<select aria-label="Số ảnh chụp liên tiếp" value={batchSize} disabled={locked} onChange={e => setBatchSize(+e.target.value)}>{[1, 3, 4, 6].map(n => <option key={n} value={n}>{n} ảnh</option>)}</select></label></div>
          <div className="studio-topline"><div><span className={`status-dot ${ready ? 'live' : ''}`} /><span>{capture.busy ? capture.remaining !== null ? 'Sẵn sàng tạo dáng nhé' : 'Đang lưu khoảnh khắc' : ready ? 'Camera đã sẵn sàng' : 'Góc chụp của bạn'}</span></div><span className="format-label">{total} khoảnh khắc <span>·</span> tối đa 6</span></div>
          <div className={`camera-stage ${ready ? 'is-live' : ''}`}>
            <video ref={camera.videoRef} autoPlay playsInline muted onCanPlay={camera.ready} onLoadedData={camera.ready} aria-label="Hình ảnh trực tiếp từ camera" style={{ opacity: 0 }} />
            {ready && <CameraPreview videoRef={camera.videoRef} edit={currentEdit} mirror={mirror} before={before} />}
            {!ready && <div className="camera-placeholder"><div className="floating-star star-one">✧</div><div className="floating-star star-two">✦</div><div className="camera-illustration"><Camera size={48} strokeWidth={1.15} /><span>♡</span></div><h2>Một nụ cười, một kỷ niệm</h2><p>Bật camera, chọn góc xinh nhất<br />và lưu lại phiên bản hôm nay của bạn.</p><button className="primary camera-enable" onClick={() => void camera.start()} disabled={camera.status === 'loading' || locked}>{camera.status === 'loading' ? <LoaderCircle className="spin" size={17} /> : <Camera size={17} />}{camera.status === 'loading' ? 'Đang kết nối…' : 'Bật camera'}</button><span className="permission-note"><LockKeyhole size={12} /> Chỉ bạn nhìn thấy hình ảnh của mình</span>{camera.status === 'loading' && <button className="text-button" onClick={camera.stop}>Hủy kết nối</button>}</div>}
            <div className="viewfinder corner-tl" /><div className="viewfinder corner-tr" /><div className="viewfinder corner-bl" /><div className="viewfinder corner-br" />
            {ready && <div className="camera-tools"><button className={`glass-button ${mirror ? 'active' : ''}`} onClick={() => setMirror(v => !v)} disabled={locked} aria-label="Lật gương" aria-pressed={mirror} title="Lật gương"><FlipHorizontal2 size={19} /></button><div><button className="glass-button" onClick={() => void camera.start(undefined, camera.facing === 'user' ? 'environment' : 'user')} disabled={locked} aria-label="Chuyển camera trước hoặc sau" title="Chuyển camera"><SwitchCamera size={19} /></button><button className="glass-button" onClick={camera.stop} disabled={locked} aria-label="Tắt camera" title="Tắt camera"><CameraOff size={18} /></button></div></div>}
            {capture.remaining !== null && <div className="countdown" role="status" aria-label={`Còn ${capture.remaining} giây`} key={capture.remaining}>{capture.remaining}</div>}
            {capture.flash && effects && <div className="camera-flash" />}
            <div className="capture-progress" aria-live="polite"><span className={total === 6 ? 'complete-dot' : ''} />Đã chụp {total}/6</div>
          </div>
          {camera.error && <div role="alert" className="message error-message"><CameraOff size={17} /><span>{camera.error}</span></div>}
          {camera.devices.length > 1 && <div className="camera-selector"><Camera size={14} /><select aria-label="Thiết bị camera" disabled={locked || camera.status === 'loading'} value={camera.deviceId} onChange={e => void camera.start(e.target.value, camera.facing)}>{camera.devices.map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${i + 1}`}</option>)}</select><ChevronDown size={14} /></div>}
          <div className="capture-controls"><button className="secondary-shot" onClick={() => startCapture(false)} disabled={!canCapture}><span><Camera size={22} /></span>{selected !== null && photos[selected] ? 'Chụp lại ảnh' : 'Chụp từng ảnh'}</button><button className="auto-shot" onClick={() => startCapture(true)} disabled={!ready || locked || total === 6} aria-label="Chụp tự động"><span><Aperture size={36} strokeWidth={1.5} /></span><b>Chụp tự động</b></button><button className="secondary-shot reset-shot" onClick={reset} disabled={locked || !photos.some(Boolean)}><span><RotateCcw size={22} /></span>Chụp lại tất cả</button></div>
          {capture.busy ? <button className="cancel-button" onClick={capture.cancel}><X size={16} />Hủy chụp</button> : <p className="capture-hint">{selected !== null ? `Đã chọn ô ${selected + 1}. Chụp hoặc tải ảnh để thay thế.` : total === 6 ? 'Đủ bộ rồi! Xem thành phẩm hoặc chọn một ảnh để chụp lại.' : 'Thả lỏng vai, nghiêng đầu nhẹ… và cười thôi ♡'}</p>}
          <div className="capture-preferences"><label><input type="checkbox" checked={sound} disabled={locked} onChange={e => { setSound(e.target.checked); if (e.target.checked) shutter.prepare(); }} />Âm thanh chụp</label><label><input type="checkbox" checked={effects} onChange={e => setEffects(e.target.checked)} />Hiệu ứng dịu nhẹ</label></div>
          <div className="upload-divider"><span /><button disabled={locked} onClick={() => chooseUpload()}><Upload size={16} />{uploading ? 'Đang xử lý ảnh…' : 'Tải ảnh từ thiết bị'}</button><span /></div>
        </section>}
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="Chọn tệp ảnh" onChange={e => void handleUpload(e.target.files)} />
          {(notice || error) && <div className={`message ${error ? 'error-message' : ''}`} role={error ? 'alert' : 'status'}><span>{error || notice}</span><button aria-label="Ẩn thông báo" onClick={() => { setError(''); setNotice(''); }}><X size={15} /></button></div>}
        {step === 3 && <FilterEditor edit={currentEdit} onChange={changeEdit} disabled={locked} originalSrc={photos[selected ?? 0]?.originalSrc} selected={selected ?? 0} before={before} onBefore={setBefore} hasPhotos={total > 0} onApplyAll={() => { setPhotos(previous => previous.map(p => p ? { ...p, edit: { ...currentEdit } } : p)); setNotice('Đã áp dụng công thức màu từ ảnh gốc cho cả bộ ảnh.'); }} videoRef={camera.videoRef} cameraReady={false} mirror={mirror} />}
        {step < 4 && <aside className="wizard-preview panel">
          <div className="panel-heading"><h2>{step === 1 ? 'Khoảnh khắc của bạn' : 'Chiếc khung của bạn'}</h2><span className="count-pill">{step === 1 ? total : count}/{step === 1 ? 6 : layout.count}</span></div>
          {step !== 1 && <FramePreview layout={layout} photos={currentPhotos} options={options} disabled={locked} />}
          <div className="wizard-shots">{photos.map((photo, i) => photo && <div className={`wizard-shot ${selected === i ? 'selected' : ''} ${step !== 1 && i >= layout.count ? 'unused' : ''}`} key={photo.id}><button className="slot-select" disabled={locked} aria-label={`Chọn ảnh ${i + 1} để thay thế`} aria-pressed={selected === i} onClick={() => { setSelected(i); setBefore(false); }}><EditedPhoto src={photo.originalSrc} edit={photo.edit} alt={`Ảnh ${i + 1}`} width={350} /><span>{i + 1}{step !== 1 && i >= layout.count ? ' · Dự phòng' : ''}</span></button>{step === 1 && <div className="slot-actions"><button disabled={locked || !ready} onClick={() => startCapture(false, i)} aria-label={`Chụp lại ảnh ${i + 1}`}>Chụp lại</button><button disabled={locked} onClick={() => chooseUpload(i)} aria-label={`Thay ảnh ${i + 1}`}>Thay</button><button disabled={locked} aria-label={`Xóa ảnh ${i + 1}`} onClick={() => { setPhotos(p => [...p.filter((_, n) => n !== i), null]); setSelected(null); }}>Xóa</button></div>}</div>)}</div>
          {!total && <div className="shots-empty"><ImagePlus size={32} /><p>Những nụ cười sẽ xuất hiện ở đây.</p><span>Chụp ảnh hoặc tải ảnh từ thiết bị để bắt đầu.</span></div>}
          {step === 2 && count < layout.count && <div className="message">Cần thêm {layout.count - count} ảnh cho mẫu này.<button className="text-button" onClick={() => setStep(1)}>Quay lại chụp bổ sung</button></div>}
          {step === 2 && total > layout.count && <p className="small">Mẫu dùng {layout.count} ảnh đầu. Ảnh dự phòng vẫn được giữ khi bạn đổi mẫu.</p>}
        </aside>}
        {step === 4 && result && <ResultViewer inline result={result} photos={currentPhotos as Photo[]} layoutId={layoutId} options={options} effects={effects} onClose={() => setStep(3)} onReset={reset} onWall={openWall} />}
      </div>
      {step < 4 && <div className="wizard-navigation"><button className="soft-button" disabled={locked || step === 1} onClick={() => { setBefore(false); setStep(v => v - 1); }}>← Quay lại</button><span>Bước {step} / 4</span><button className="primary" disabled={locked || (step === 1 ? total === 0 : count < layout.count)} onClick={() => { setSelected(photos.findIndex(Boolean)); setBefore(false); if (step === 3) void showResult(); else { setSelected(step === 1 ? null : photos.findIndex(Boolean)); setStep(v => v + 1); } }}>{exporting ? 'Đang ghép ảnh…' : step === 3 ? 'Xem thành phẩm' : 'Tiếp tục →'}</button></div>}
      <div className="bottom-message"><span>✧</span> Những điều bình thường, khi được lưu lại, đều trở nên đặc biệt. <span>✧</span></div>
    </main>
    <footer><span className="footer-logo">PhotoBeo</span><span>Một góc nhỏ, thật nhiều kỷ niệm.</span><span>Được làm với <Heart size={12} fill="currentColor" /></span></footer>
    {help && <Dialog title="Một bộ ảnh xinh trong 4 bước" onClose={() => setHelp(false)}><ol className="help-steps"><li><b>Chụp ảnh</b><p>Bật camera hoặc tải ảnh từ thiết bị. Chụp từng ảnh hay liên tiếp, xóa và chụp lại tùy thích.</p></li><li><b>Chọn mẫu</b><p>Chọn bố cục, khung, sticker và lời nhắn. Thiếu ảnh thì quay lại chụp bổ sung.</p></li><li><b>Chỉnh sửa</b><p>Chọn từng ảnh để chỉnh màu; ảnh gốc luôn được giữ. Thử Before/After và Reset.</p></li><li><b>Thành phẩm</b><p>Tải PNG HD, đồng ý lưu lịch sử 30 ngày hoặc giữ bản sao riêng trên Memory Wall.</p></li></ol><p>Ảnh đang chỉnh nằm trong bộ nhớ trình duyệt. Hãy tải hoặc lưu trước khi đóng trang.</p><button className="primary" onClick={() => setHelp(false)}>Bắt đầu tạo kỷ niệm</button></Dialog>}
  </div>;
}
