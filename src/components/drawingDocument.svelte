<script lang="ts">
  import { onMount } from "svelte";

  type Point = { x: number; y: number };
  type Stroke = {
    color: string;
    width: number;
    tool: "pen" | "eraser";
    points: Point[];
  };
  type DrawingFile = {
    version: 1;
    width: number;
    height: number;
    strokes: Stroke[];
  };
  type ResizeState = {
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  };

  const DEFAULT_WIDTH = 1200;
  const DEFAULT_HEIGHT = 800;
  const MIN_DOCUMENT_SIZE = 320;
  const MAX_DOCUMENT_SIZE = 4000;
  const MAX_RENDER_SIZE = 4096;
  const colors = ["#242722", "#bf5f4b", "#3f7392", "#4e8058", "#81629a"];
  const { value, onChange, onSave } = $props<{
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
  }>();

  let canvas: HTMLCanvasElement;
  let viewport: HTMLDivElement;
  let strokes = $state<Stroke[]>([]);
  let redoStack = $state<Stroke[]>([]);
  let activeStroke: Stroke | null = null;
  let tool = $state<"pen" | "eraser">("pen");
  let color = $state(colors[0]);
  let size = $state(5);
  let documentWidth = $state(DEFAULT_WIDTH);
  let documentHeight = $state(DEFAULT_HEIGHT);
  let zoom = $state(100);
  let resizing = $state(false);
  let resizeState: ResizeState | null = null;
  let zoomTouched = false;
  let lastLoadedValue = "";
  let resizeObserver: ResizeObserver | undefined;
  let viewportObserver: ResizeObserver | undefined;

  function parseDrawing(serialized: string): DrawingFile {
    const fallback: DrawingFile = {
      version: 1,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      strokes: [],
    };
    if (!serialized.trim()) return fallback;
    try {
      const parsed = JSON.parse(serialized) as Partial<DrawingFile>;
      if (!Array.isArray(parsed.strokes)) return fallback;
      return {
        version: 1,
        width: validDocumentSize(parsed.width, DEFAULT_WIDTH),
        height: validDocumentSize(parsed.height, DEFAULT_HEIGHT),
        strokes: parsed.strokes.filter(
          (stroke): stroke is Stroke =>
            Boolean(stroke) &&
            (stroke.tool === "pen" || stroke.tool === "eraser") &&
            typeof stroke.color === "string" &&
            typeof stroke.width === "number" &&
            Array.isArray(stroke.points),
        ),
      };
    } catch {
      return fallback;
    }
  }

  function validDocumentSize(value: unknown, fallback: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(MAX_DOCUMENT_SIZE, Math.max(MIN_DOCUMENT_SIZE, Math.round(value)));
  }

  function serializeDrawing() {
    return JSON.stringify({ version: 1, width: documentWidth, height: documentHeight, strokes });
  }

  function context() {
    return canvas?.getContext("2d") ?? null;
  }

  function prepareContext(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(canvas.width / documentWidth, 0, 0, canvas.height / documentHeight, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (!stroke.points.length) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) {
      ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function redraw() {
    const ctx = context();
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    prepareContext(ctx);
    for (const stroke of strokes) renderStroke(ctx, stroke);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const renderScale = Math.min(
      dpr,
      MAX_RENDER_SIZE / Math.max(1, rect.width),
      MAX_RENDER_SIZE / Math.max(1, rect.height),
    );
    const width = Math.max(1, Math.round(rect.width * renderScale));
    const height = Math.max(1, Math.round(rect.height * renderScale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    redraw();
  }

  function pointFor(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * documentWidth,
      y: ((event.clientY - rect.top) / rect.height) * documentHeight,
    };
  }

  function beginStroke(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    const stroke: Stroke = {
      color,
      width: tool === "eraser" ? size * 4 : size,
      tool,
      points: [pointFor(event)],
    };
    strokes.push(stroke);
    activeStroke = stroke;
    redoStack = [];
    const ctx = context();
    if (ctx) {
      prepareContext(ctx);
      renderStroke(ctx, stroke);
    }
  }

  function continueStroke(event: PointerEvent) {
    if (!activeStroke || !canvas.hasPointerCapture(event.pointerId)) return;
    const events = event.getCoalescedEvents?.() ?? [event];
    const ctx = context();
    if (!ctx) return;
    prepareContext(ctx);
    for (const pointerEvent of events) {
      const previous = activeStroke.points.at(-1)!;
      const next = pointFor(pointerEvent);
      activeStroke.points.push(next);
      renderStroke(ctx, { ...activeStroke, points: [previous, next] });
    }
  }

  function finishStroke(event: PointerEvent) {
    if (!activeStroke) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    activeStroke = null;
    emitChange();
  }

  function emitChange() {
    lastLoadedValue = serializeDrawing();
    onChange(lastLoadedValue);
  }

  function undo() {
    const stroke = strokes.pop();
    if (!stroke) return;
    redoStack.push(stroke);
    redraw();
    emitChange();
  }

  function redo() {
    const stroke = redoStack.pop();
    if (!stroke) return;
    strokes.push(stroke);
    redraw();
    emitChange();
  }

  function clearDrawing() {
    if (!strokes.length) return;
    if (!confirm("Clear this drawing? This cannot be undone.")) return;
    redoStack = [];
    strokes = [];
    redraw();
    emitChange();
  }

  function setZoom(nextZoom: number, markTouched = true) {
    zoom = Math.min(300, Math.max(25, Math.round(nextZoom / 5) * 5));
    if (markTouched) zoomTouched = true;
  }

  function fitToWindow(markTouched = true) {
    if (!viewport) return;
    const horizontalZoom = ((viewport.clientWidth - 32) / documentWidth) * 100;
    const verticalZoom = ((viewport.clientHeight - 32) / documentHeight) * 100;
    setZoom(Math.min(horizontalZoom, verticalZoom, 100), markTouched);
  }

  function beginResize(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    resizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: documentWidth,
      startHeight: documentHeight,
    };
    resizing = true;
    zoomTouched = true;
  }

  function continueResize(event: PointerEvent) {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const zoomScale = zoom / 100;
    let nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX) / zoomScale;
    let nextHeight = resizeState.startHeight + (event.clientY - resizeState.startY) / zoomScale;
    if (event.shiftKey) {
      const widthScale = nextWidth / resizeState.startWidth;
      const heightScale = nextHeight / resizeState.startHeight;
      const scale = Math.abs(widthScale - 1) > Math.abs(heightScale - 1) ? widthScale : heightScale;
      nextWidth = resizeState.startWidth * scale;
      nextHeight = resizeState.startHeight * scale;
    }
    documentWidth = validDocumentSize(nextWidth, documentWidth);
    documentHeight = validDocumentSize(nextHeight, documentHeight);
  }

  function finishResize(event: PointerEvent) {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    resizeState = null;
    resizing = false;
    redoStack = [];
    emitChange();
  }

  function resizeWithKeyboard(event: KeyboardEvent) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const amount = event.shiftKey ? 100 : 10;
    if (event.key === "ArrowRight") documentWidth += amount;
    if (event.key === "ArrowLeft") documentWidth -= amount;
    if (event.key === "ArrowDown") documentHeight += amount;
    if (event.key === "ArrowUp") documentHeight -= amount;
    documentWidth = validDocumentSize(documentWidth, DEFAULT_WIDTH);
    documentHeight = validDocumentSize(documentHeight, DEFAULT_HEIGHT);
    redoStack = [];
    emitChange();
  }

  function keydown(event: KeyboardEvent) {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave();
    } else if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    } else if (modifier && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
    } else if (modifier && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      setZoom(zoom + 25);
    } else if (modifier && event.key === "-") {
      event.preventDefault();
      setZoom(zoom - 25);
    } else if (modifier && event.key === "0") {
      event.preventDefault();
      setZoom(100);
    } else if (!modifier && event.key.toLowerCase() === "p") {
      tool = "pen";
    } else if (!modifier && event.key.toLowerCase() === "e") {
      tool = "eraser";
    }
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    viewportObserver = new ResizeObserver(() => {
      if (!zoomTouched) fitToWindow(false);
    });
    viewportObserver.observe(viewport);
    fitToWindow(false);
    resizeCanvas();
    return () => {
      resizeObserver?.disconnect();
      viewportObserver?.disconnect();
    };
  });

  $effect(() => {
    if (value !== lastLoadedValue) {
      const drawing = parseDrawing(value);
      strokes = drawing.strokes;
      documentWidth = drawing.width;
      documentHeight = drawing.height;
      redoStack = [];
      lastLoadedValue = value;
      redraw();
      if (!zoomTouched) setTimeout(() => fitToWindow(false));
    }
  });
</script>

<div class="drawing-editor">
  <div class="drawing-toolbar" aria-label="Drawing tools">
    <div class="tool-group">
      <button class:active={tool === "pen"} onclick={() => (tool = "pen")} title="Pen (P)">
        <span aria-hidden="true">✎</span> Pen
      </button>
      <button class:active={tool === "eraser"} onclick={() => (tool = "eraser")} title="Eraser (E)">
        <span aria-hidden="true">◇</span> Eraser
      </button>
    </div>
    <div class="divider"></div>
    <div class="colors" aria-label="Ink color">
      {#each colors as swatch}
        <button
          class:chosen={color === swatch}
          class="swatch"
          style={`--swatch: ${swatch}`}
          aria-label={`Use ${swatch}`}
          onclick={() => {
            color = swatch;
            tool = "pen";
          }}
        ></button>
      {/each}
    </div>
    <label class="size">
      <span>Size</span><input type="range" min="2" max="18" step="1" bind:value={size} />
    </label>
    <div class="view-controls" aria-label="Zoom controls">
      <button onclick={() => setZoom(zoom - 25)} disabled={zoom <= 25} aria-label="Zoom out"
        >−</button
      >
      <button class="zoom-level" onclick={() => setZoom(100)} title="Reset zoom to 100%"
        >{zoom}%</button
      >
      <button onclick={() => setZoom(zoom + 25)} disabled={zoom >= 300} aria-label="Zoom in"
        >+</button
      >
      <button onclick={() => fitToWindow()} title="Fit drawing in the window">Fit</button>
    </div>
    <span class="document-dimensions" title="Canvas size">{documentWidth} × {documentHeight}</span>
    <div class="history">
      <button onclick={undo} disabled={!strokes.length} aria-label="Undo" title="Undo">↶</button>
      <button onclick={redo} disabled={!redoStack.length} aria-label="Redo" title="Redo">↷</button>
      <button class="clear" onclick={clearDrawing} disabled={!strokes.length}>Clear</button>
    </div>
  </div>
  <div bind:this={viewport} class="canvas-viewport">
    <div
      class="canvas-frame"
      class:resizing
      style={`width: ${Math.round((documentWidth * zoom) / 100)}px; height: ${Math.round((documentHeight * zoom) / 100)}px;`}
    >
      <canvas
        bind:this={canvas}
        aria-label={`Drawing canvas, ${documentWidth} by ${documentHeight} pixels at ${zoom}% zoom`}
        tabindex="0"
        onkeydown={keydown}
        onpointerdown={beginStroke}
        onpointermove={continueStroke}
        onpointerup={finishStroke}
        onpointercancel={finishStroke}
      ></canvas>
      <button
        class="resize-handle"
        aria-label="Resize drawing canvas"
        title="Drag to resize. Hold Shift to preserve proportions."
        onpointerdown={beginResize}
        onpointermove={continueResize}
        onpointerup={finishResize}
        onpointercancel={finishResize}
        onkeydown={resizeWithKeyboard}><span aria-hidden="true"></span></button
      >
    </div>
  </div>
</div>

<style>
  .drawing-editor {
    display: flex;
    min-height: calc(100vh - 196px);
    flex-direction: column;
    gap: 12px;
  }
  .drawing-toolbar {
    display: flex;
    width: min(100%, 1100px);
    min-height: 44px;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0 auto;
    padding: 6px 8px;
    border: 1px solid #34383a;
    border-radius: 8px;
    background: #1d2022;
    color: #ced1ce;
  }
  .tool-group,
  .colors,
  .view-controls,
  .history {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .drawing-toolbar button {
    height: 30px;
    padding: 0 9px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: #b9bdbb;
    font-size: 12px;
  }
  .drawing-toolbar button:hover:not(:disabled),
  .drawing-toolbar button.active {
    border-color: #48504a;
    background: #2b332d;
    color: #eef2ee;
  }
  .drawing-toolbar button:disabled {
    cursor: default;
    opacity: 0.35;
  }
  .tool-group span {
    margin-right: 4px;
  }
  .divider {
    width: 1px;
    height: 24px;
    background: #393d40;
  }
  .swatch {
    position: relative;
    width: 24px !important;
    padding: 0 !important;
    border-radius: 50% !important;
  }
  .swatch::before {
    position: absolute;
    inset: 5px;
    border-radius: 50%;
    background: var(--swatch);
    content: "";
  }
  .swatch.chosen {
    border-color: #b8d5be !important;
  }
  .size {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #929795;
    font-size: 11px;
  }
  .size input {
    width: 82px;
    accent-color: #a8c9af;
  }
  .view-controls {
    padding-left: 8px;
    border-left: 1px solid #393d40;
  }
  .view-controls button {
    min-width: 30px;
    font-size: 14px;
  }
  .view-controls .zoom-level {
    min-width: 48px;
    color: #d9dcd9;
    font-size: 11px;
  }
  .document-dimensions {
    display: inline-flex;
    min-width: 92px;
    height: 30px;
    align-items: center;
    justify-content: center;
    padding: 0 9px;
    border: 1px solid #383d3f;
    border-radius: 6px;
    color: #939896;
    font-size: 11px;
  }
  .history {
    margin-left: auto;
  }
  .history button {
    font-size: 17px;
  }
  .history .clear {
    margin-left: 3px;
    font-size: 11px;
  }
  .canvas-viewport {
    width: min(100%, 1100px);
    height: clamp(320px, calc(100vh - 260px), 760px);
    margin: auto;
    padding: 16px;
    overflow: auto;
    border: 1px solid #303437;
    border-radius: 7px;
    background: #121416;
  }
  .canvas-frame {
    position: relative;
    margin: 0 auto;
    border: 1px solid #3b3e40;
    border-radius: 4px;
    background: #f4f2ec;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
    line-height: 0;
    overflow: hidden;
  }
  .canvas-frame canvas {
    display: block;
    width: 100%;
    height: 100%;
    background: #f4f2ec;
    cursor: crosshair;
    touch-action: none;
  }
  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 2;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px 0 0 0;
    background: rgba(31, 36, 33, 0.82);
    cursor: nwse-resize;
    touch-action: none;
  }
  .resize-handle span,
  .resize-handle span::before {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 10px;
    height: 10px;
    border-right: 2px solid #c7d8ca;
    border-bottom: 2px solid #c7d8ca;
    content: "";
  }
  .resize-handle span::before {
    right: 4px;
    bottom: 4px;
    width: 4px;
    height: 4px;
    opacity: 0.65;
  }
  .resize-handle:hover,
  .resize-handle:focus-visible,
  .canvas-frame.resizing .resize-handle {
    outline: 0;
    background: #35463a;
  }
  @media (max-width: 760px) {
    .drawing-toolbar {
      flex-wrap: wrap;
    }
    .divider {
      display: none;
    }
    .size {
      order: 3;
    }
    .history {
      margin-left: auto;
    }
    .drawing-editor {
      min-height: calc(100vh - 180px);
    }
  }
</style>
