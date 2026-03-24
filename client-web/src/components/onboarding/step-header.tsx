import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type StepHeaderProps = {
  currentStep: number;
  totalSteps: number;
  title: string;
  description: string;
  steps: string[];
};

export function StepHeader({ currentStep, totalSteps, title, description, steps }: StepHeaderProps) {
  const progressValue = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="rounded-full">
            Step {currentStep} of {totalSteps}
          </Badge>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Organization setup progress</p>
          <p className="text-sm text-muted-foreground">{Math.round(progressValue)}%</p>
        </div>
        <Progress value={progressValue} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;

          return (
            <div
              key={step}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                isActive
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : isComplete
                    ? "border-border bg-muted/60 text-foreground"
                    : "border-border bg-background text-muted-foreground"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-[0.12em]">{`0${stepNumber}`}</p>
              <p className="mt-2 font-medium">{step}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
