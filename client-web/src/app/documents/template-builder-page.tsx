import { useEffect, useMemo, useRef, useState } from "react";
import { DocusealBuilder } from "@docuseal/react";
import { ArrowLeft, CheckCircle2, FileSignature } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTemplateBuilderToken, useDocumentTemplates, useSyncDocumentTemplateFromDocuseal } from "@/hooks/useDocuments";

export function DocumentTemplateBuilderPage() {
  const navigate = useNavigate();
  const { orgId, templateId } = useParams<{ orgId: string; templateId: string }>();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const requestedTemplateKeyRef = useRef<string | null>(null);
  const tokenRequest = useDocumentTemplateBuilderToken();
  const syncTemplate = useSyncDocumentTemplateFromDocuseal(orgId);
  const { data: templates = [] } = useDocumentTemplates(orgId);
  const template = useMemo(() => templates.find((item) => item.id === templateId) ?? null, [templateId, templates]);

  useEffect(() => {
    if (!orgId || !templateId) {
      return;
    }

    const templateKey = `${orgId}:${templateId}`;
    if (requestedTemplateKeyRef.current === templateKey) {
      return;
    }

    requestedTemplateKeyRef.current = templateKey;
    tokenRequest.reset();
    tokenRequest.mutate({ organizationId: orgId, templateId });
  }, [orgId, templateId]);

  const token = tokenRequest.data?.token ?? null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/dashboard?section=documents")}>
              <ArrowLeft className="size-4" />
              Documents
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{template?.title ?? "Document builder"}</h1>
                {template ? (
                  <Badge variant={template.builderStatus === "ready" ? "secondary" : "outline"} className="capitalize">
                    {template.builderStatus.replace("_", " ")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Add signing fields and save the form to make it sendable.</p>
            </div>
          </div>
          <Badge variant={saveState === "saved" ? "secondary" : "outline"} className="w-fit capitalize">
            {saveState === "saving" ? "saving" : saveState === "saved" ? "saved" : saveState === "error" ? "sync failed" : "builder"}
          </Badge>
        </div>

        {tokenRequest.error ? (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle>Builder unavailable</CardTitle>
              <CardDescription>{tokenRequest.error.message}</CardDescription>
            </CardHeader>
          </Card>
        ) : !token ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading builder</CardTitle>
              <CardDescription>Preparing a secure DocuSeal builder session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-[620px] rounded-lg" />
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <FileSignature className="size-5 text-muted-foreground" />
                <CardTitle>DocuSeal form builder</CardTitle>
              </div>
              <CardDescription>Changes are saved through DocuSeal and synced back into this organization library.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DocusealBuilder
                token={token}
                className="min-h-[720px] w-full"
                onSave={async (data) => {
                  if (!orgId || !templateId) {
                    return;
                  }

                  setSaveState("saving");
                  try {
                    await syncTemplate.mutateAsync({ organizationId: orgId, templateId, docusealData: data });
                    setSaveState("saved");
                  } catch {
                    setSaveState("error");
                  }
                }}
                onLoad={async (data) => {
                  console.debug("DocuSeal builder loaded", data);
                }}
              />
            </CardContent>
          </Card>
        )}

        {saveState === "saved" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Template is ready for employee and external sends.
          </div>
        ) : null}
      </div>
    </main>
  );
}
