import React from 'react';
import BuildingDetailPage from './BuildingDetailPage';

export default function BuildingDetailModal({
  isOpen,
  onClose,
  building,
  onBuildingUpdated,
  onBuildingDeleted,
  onOpenAddRoom,
  onSelectRoom,
}) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#f4f5f7] rounded-3xl w-full max-w-6xl h-[92vh] max-h-[900px] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
      >
        <BuildingDetailPage
          building={building}
          onBack={onClose}
          onBuildingUpdated={onBuildingUpdated}
          onBuildingDeleted={onBuildingDeleted}
          onOpenAddRoom={onOpenAddRoom}
          onSelectRoom={onSelectRoom}
        />
      </div>
    </div>
  );
}

export { BuildingDetailPage };
