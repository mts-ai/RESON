import { useState } from 'react';
import { Settings, ChevronDown, CheckCircle2 } from './icons';
import { Button } from './ui/button';
import { ModelSelectorDialog } from './ModelSelectorDialog';

interface ModelInfo {
  name: string;
  displayName: string;
}

interface ModelSettingsButtonProps {
  availableModels: ModelInfo[];
  baseModel: string | null;
  targetModel: string | null;
  optionalModels: string[];
  onBaseModelChange: (model: string | null) => void;
  onTargetModelChange: (model: string | null) => void;
  onOptionalModelsChange: (models: string[]) => void;
}

export function ModelSettingsButton({
  availableModels,
  baseModel,
  targetModel,
  optionalModels,
  onBaseModelChange,
  onTargetModelChange,
  onOptionalModelsChange,
}: ModelSettingsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get display names
  const getDisplayName = (modelName: string | null) => {
    if (!modelName) return '—';
    return availableModels.find(m => m.name === modelName)?.displayName || modelName;
  };

  const baseDisplayName = getDisplayName(baseModel);
  const targetDisplayName = getDisplayName(targetModel);
  const totalSelected = [baseModel, targetModel, ...optionalModels].filter(Boolean).length;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="relative h-auto py-2 px-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 border-blue-200/50 dark:border-blue-800/50 shadow-sm transition-all"
        data-tour="model-selector"
      >
        {/* Badge with count */}
        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-medium shadow-md">
          {totalSelected}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          
          {/* Text content */}
          <div className="flex flex-col items-start gap-0.5">
            <div className="text-sm font-medium text-foreground">
              Настройки моделей
            </div>
            <div className="text-[11px] text-muted-foreground">
              {baseDisplayName} → {targetDisplayName}
              {optionalModels.length > 0 && ` +${optionalModels.length}`}
            </div>
          </div>
        </div>
      </Button>

      <ModelSelectorDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        availableModels={availableModels}
        baseModel={baseModel}
        targetModel={targetModel}
        optionalModels={optionalModels}
        onBaseModelChange={onBaseModelChange}
        onTargetModelChange={onTargetModelChange}
        onOptionalModelsChange={onOptionalModelsChange}
      />
    </>
  );
}