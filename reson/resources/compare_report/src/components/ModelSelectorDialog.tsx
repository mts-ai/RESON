import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { 
  Sparkles, 
  CheckCheck, 
  X, 
  GitCompare,
  AlertTriangle,
  CheckCircle2,
} from './icons';

interface ModelInfo {
  name: string;
  displayName: string;
}

interface ModelSelectorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  availableModels: ModelInfo[];
  baseModel: string | null;
  targetModel: string | null;
  optionalModels: string[];
  onBaseModelChange: (model: string | null) => void;
  onTargetModelChange: (model: string | null) => void;
  onOptionalModelsChange: (models: string[]) => void;
}

export function ModelSelectorDialog({
  isOpen,
  onOpenChange,
  availableModels,
  baseModel,
  targetModel,
  optionalModels,
  onBaseModelChange,
  onTargetModelChange,
  onOptionalModelsChange
}: ModelSelectorDialogProps) {
  const handleModelToggle = (modelName: string) => {
    if (modelName === baseModel) {
      onBaseModelChange(null);
      return;
    }

    if (modelName === targetModel) {
      onTargetModelChange(null);
      return;
    }

    if (optionalModels.includes(modelName)) {
      onOptionalModelsChange(optionalModels.filter((m) => m !== modelName));
      return;
    }

    if (!baseModel) {
      onBaseModelChange(modelName);
      return;
    }

    if (!targetModel) {
      onTargetModelChange(modelName);
      return;
    }

    onOptionalModelsChange([...optionalModels, modelName]);
  };

  const handleSelectAll = () => {
    if (availableModels.length >= 2) {
      onBaseModelChange(availableModels[0].name);
      onTargetModelChange(availableModels[availableModels.length - 1].name);
      onOptionalModelsChange(availableModels.slice(1, -1).map(m => m.name));
    } else if (availableModels.length === 1) {
      onBaseModelChange(availableModels[0].name);
      onTargetModelChange(null);
      onOptionalModelsChange([]);
    }
  };

  const handleClearAll = () => {
    onBaseModelChange(null);
    onTargetModelChange(null);
    onOptionalModelsChange([]);
  };

  const handleBaselineVsCandidate = () => {
    if (availableModels.length >= 2) {
      onBaseModelChange(availableModels[0].name);
      onTargetModelChange(availableModels[availableModels.length - 1].name);
      onOptionalModelsChange([]);
    }
  };

  const selectedCount = [baseModel, targetModel, ...optionalModels].filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Управление моделями
          </DialogTitle>
          <DialogDescription>
            Выберите модели для анализа и сравнения
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Actions */}
          <div className="reson-model-preset-row flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="flex-1"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Выбрать все
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaselineVsCandidate}
              className="flex-1"
            >
              <GitCompare className="w-3.5 h-3.5 mr-1.5" />
              Base vs Target
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="flex-1"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Очистить
            </Button>
          </div>

          {/* Instructions */}
          <div className="p-3 rounded-md bg-muted/50 space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white">1</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Выберите <span className="text-blue-600 dark:text-blue-400">Base</span> модель — относительно неё будет считаться дельта по статистикам
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white">2</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Выберите <span className="text-green-600 dark:text-green-400">Target</span> модель — основную модель для сравнения с Base
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white">3</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Добавьте <span className="text-purple-600 dark:text-purple-400">опциональные</span> модели для расширенного анализа (необязательно)
              </p>
            </div>
          </div>

          {/* Model List */}
          <div className="space-y-2">
            {availableModels.map(model => {
              const isBase = model.name === baseModel;
              const isTarget = model.name === targetModel;
              const isOptional = optionalModels.includes(model.name);
              const isSelected = isBase || isTarget || isOptional;

              let borderColor = 'border-border';
              let bgColor = '';

              if (isBase) {
                borderColor = 'border-blue-500';
                bgColor = 'bg-blue-50 dark:bg-blue-950/20';
              } else if (isTarget) {
                borderColor = 'border-green-500';
                bgColor = 'bg-green-50 dark:bg-green-950/20';
              } else if (isOptional) {
                borderColor = 'border-purple-500';
                bgColor = 'bg-purple-50 dark:bg-purple-950/20';
              }

              return (
                <div
                  key={model.name}
                  onClick={() => handleModelToggle(model.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleModelToggle(model.name);
                    }
                  }}
                  role="checkbox"
                  tabIndex={0}
                  className={`
                    flex items-center gap-3 p-3 rounded-md border transition-all duration-200
                    ${borderColor} ${bgColor}
                    ${!isSelected ? 'hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50/30 dark:hover:bg-gray-950/10' : 'shadow-sm'}
                    cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1
                    active:scale-[0.98]
                  `}
                  aria-checked={isSelected}
                  aria-label={`${isSelected ? 'Убрать' : 'Добавить'} модель ${model.displayName}`}
                >
                  <Checkbox
                    checked={isSelected}
                    className="pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" title={model.displayName}>
                      {model.displayName}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {isBase && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Base
                        </Badge>
                      )}
                      {isTarget && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                          Target
                        </Badge>
                      )}
                      {isOptional && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          Optional
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status */}
          <div className="pt-3 border-t">
            {!baseModel || !targetModel ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Необходимо выбрать Base и Target модели</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Выбрано {selectedCount} из {availableModels.length} моделей</span>
                </div>
                {optionalModels.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4 flex-shrink-0 text-purple-500" />
                    <span>Включая {optionalModels.length} опциональных</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Закрыть
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            disabled={!baseModel || !targetModel}
          >
            Применить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
