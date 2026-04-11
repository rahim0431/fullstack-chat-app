import React, { useState, useRef, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Check, Move } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ImageCropper = ({ image, onCrop, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Reset zoom when image changes
  useEffect(() => {
    setZoom(1);
  }, [image]);

  const cropImage = () => {
    const canvas = document.createElement("canvas");
    const img = imageRef.current;
    const container = containerRef.current;
    
    if (!img || !container) return;

    // Output resolution
    const cropSize = 512; 
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext("2d");

    // Get the relative positions
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Account for object-fit: contain letterboxing
    const naturalAspect = img.naturalWidth / img.naturalHeight;
    const displayedAspect = imgRect.width / imgRect.height;
    
    let renderedWidth, renderedHeight;
    if (naturalAspect > displayedAspect) {
      renderedWidth = imgRect.width;
      renderedHeight = imgRect.width / naturalAspect;
    } else {
      renderedHeight = imgRect.height;
      renderedWidth = imgRect.height * naturalAspect;
    }

    // Actual top-left of the image content on screen
    const actualLeft = imgRect.left + (imgRect.width - renderedWidth) / 2;
    const actualTop = imgRect.top + (imgRect.height - renderedHeight) / 2;

    // The crop circle is centered in the container.
    const circleRadius = 150; 
    const centerX = containerRect.left + containerRect.width / 2;
    const centerY = containerRect.top + containerRect.height / 2;

    // Calculate how much to scale the natural image
    const scale = img.naturalWidth / renderedWidth;

    // Find the top-left of the crop area relative to the physical image content
    const startX = (centerX - actualLeft - circleRadius) * scale;
    const startY = (centerY - actualTop - circleRadius) * scale;
    const side = (circleRadius * 2) * scale;

    ctx.drawImage(
      img,
      startX, startY, side, side,
      0, 0, cropSize, cropSize
    );

    onCrop(canvas.toDataURL("image/jpeg", 0.95));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="bg-base-100 w-full max-w-[400px] rounded-[2.5rem] overflow-hidden shadow-2xl border border-base-300 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
          <h3 className="text-lg font-bold">Adjust Photo</h3>
          <button 
            type="button"
            onClick={onCancel} 
            className="text-base-content/40 hover:text-base-content transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Cropper Container */}
          <div 
            ref={containerRef}
            className="relative aspect-square w-full bg-base-200 rounded-3xl overflow-hidden touch-none"
          >
            <motion.div
              drag
              dragElastic={0.4}
              dragMomentum={false}
              className="absolute inset-0 flex items-center justify-center cursor-move"
            >
              <motion.img
                ref={imageRef}
                src={image}
                animate={{ scale: zoom }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="max-w-none w-full h-full object-contain pointer-events-none select-none"
              />
            </motion.div>
            
            {/* Overlay Viewfinder */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[85%] aspect-square border-2 border-primary rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Move className="w-8 h-8 text-primary/30" />
                 </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-base-200/50 p-2 rounded-2xl">
              <button 
                type="button"
                onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                className="btn btn-ghost btn-circle btn-sm"
              >
                <ZoomOut className="w-4 h-4 text-base-content/60" />
              </button>
              
              <div className="flex-1 px-1">
                <input 
                  type="range" 
                  min="1" 
                  max="4" 
                  step="0.01" 
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-primary" 
                />
              </div>
              
              <button 
                type="button"
                onClick={() => setZoom(Math.min(4, zoom + 0.1))}
                className="btn btn-ghost btn-circle btn-sm"
              >
                <ZoomIn className="w-4 h-4 text-base-content/60" />
              </button>
            </div>
            
            <p className="text-center text-[10px] text-base-content/30 font-bold uppercase tracking-widest">
              Drag to move • Slider to zoom
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-4 px-6 py-5 bg-base-100 border-t border-base-300">
          <button 
            type="button"
            onClick={onCancel} 
            className="flex-1 font-bold text-sm text-base-content/60 hover:text-base-content transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={cropImage} 
            className="btn btn-primary flex-[1.5] gap-2 rounded-2xl font-bold shadow-lg shadow-primary/20"
          >
            <Check className="w-5 h-5" />
            Apply Crop
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ImageCropper;
