import { useEffect, useMemo, useState } from "react";
import { Archive, Building2, ExternalLink, FileSignature, Library, Pencil, Send, Upload, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type {
  DocumentPurpose,
  DocumentRecipientStatus,
  DocumentTemplate,
  DocumentTemplateStatus,
  ExternalDocumentFilters,
} from "@/api/documents";
import type { OrganizationEmployee } from "@/api/employee";
import { formatNumber } from "@/components/dashboard/dashboard-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCreateDocumentTemplate,
  useCloneSystemDocumentTemplate,
  useDeleteDocumentTemplate,
  useDocumentRecipients,
  useDocumentTemplates,
  useEmployeeDocuments,
  useExternalDocumentRecipient,
  useExternalDocuments,
  usePatchDocumentTemplate,
  usePatchExternalDocumentRecipient,
  useSendEmployeeDocuments,
  useSendExternalDocument,
  useUploadDocumentTemplate,
} from "@/hooks/useDocuments";
import { useOrganizationEmployees } from "@/hooks/useEmployee";
import { useOrganizationPermissions } from "@/hooks/useOrg";
import type { ClientProperty } from "@/lib/api";
import { canAccess, PERMISSIONS } from "@/lib/permissions";

type DocumentsPanelProps = {
  organizationId: string;
  selectedPropertyId: string | null;
  properties: Array<Pick<ClientProperty, "id" | "name" | "organizationId">>;
};

type TemplateFormState = {
  docusealTemplateId: string;
  title: string;
  description: string;
  category: string;
  status: DocumentTemplateStatus;
};

type UploadTemplateFormState = {
  title: string;
  description: string;
  category: string;
  file: File | null;
};

type SendFormState = {
  employeeId: string;
  templateIds: string[];
  purpose: DocumentPurpose;
  messageSubject: string;
  messageBody: string;
};

type ExternalSendFormState = {
  templateId: string;
  externalName: string;
  externalEmail: string;
  externalCompany: string;
  externalGroup: string;
  externalPhone: string;
  scope: "general" | "property";
  propertyId: string;
  notes: string;
  messageSubject: string;
  messageBody: string;
};

type ExternalEditFormState = {
  externalCompany: string;
  externalGroup: string;
  externalPhone: string;
  scope: "general" | "property";
  propertyId: string;
  notes: string;
};

const emptyTemplateForm: TemplateFormState = {
  docusealTemplateId: "",
  title: "",
  description: "",
  category: "Onboarding",
  status: "active",
};

const emptyUploadTemplateForm: UploadTemplateFormState = {
  title: "",
  description: "",
  category: "Onboarding",
  file: null,
};

const emptyExternalSendForm: ExternalSendFormState = {
  templateId: "",
  externalName: "",
  externalEmail: "",
  externalCompany: "",
  externalGroup: "",
  externalPhone: "",
  scope: "property",
  propertyId: "",
  notes: "",
  messageSubject: "",
  messageBody: "",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not available";
}

function getStatusVariant(status: string): "default" | "destructive" | "outline" | "secondary" {
  if (status === "completed" || status === "active") {
    return "secondary";
  }

  if (status === "declined" || status === "failed") {
    return "destructive";
  }

  if (status === "sent" || status === "opened") {
    return "default";
  }

  return "outline";
}

function formatRecipientStatus(status: string) {
  if (status === "opened") {
    return "viewed";
  }

  if (status === "completed") {
    return "signed";
  }

  return status;
}

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof FileSignature;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-lg bg-primary-soft p-3">
          <Icon className="size-5 text-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateModal({
  isOpen,
  mode,
  form,
  onFormChange,
  onClose,
  onSubmit,
  isPending,
  errorMessage,
}: {
  isOpen: boolean;
  mode: "create" | "edit";
  form: TemplateFormState;
  onFormChange: (patch: Partial<TemplateFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  if (!isOpen) {
    return null;
  }

  const canSubmit = form.docusealTemplateId.trim().length > 0 && form.title.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Add template" : "Edit template"}</CardTitle>
          <CardDescription>Store a DocuSeal template reference for employee document sends.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="docuseal-template-id">DocuSeal template ID</Label>
            <Input
              id="docuseal-template-id"
              inputMode="numeric"
              value={form.docusealTemplateId}
              onChange={(event) => onFormChange({ docusealTemplateId: event.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(value) => onFormChange({ status: value as DocumentTemplateStatus })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="document-title">Title</Label>
            <Input id="document-title" value={form.title} onChange={(event) => onFormChange({ title: event.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="document-category">Category</Label>
            <Input
              id="document-category"
              value={form.category}
              onChange={(event) => onFormChange({ category: event.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="document-description">Description</Label>
            <Textarea
              id="document-description"
              value={form.description}
              onChange={(event) => onFormChange({ description: event.target.value })}
            />
          </div>
          {errorMessage ? <p className="text-sm text-destructive sm:col-span-2">{errorMessage}</p> : null}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={!canSubmit || isPending}>
              {isPending ? "Saving..." : "Save template"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadTemplateModal({
  isOpen,
  form,
  onFormChange,
  onClose,
  onSubmit,
  isPending,
  errorMessage,
}: {
  isOpen: boolean;
  form: UploadTemplateFormState;
  onFormChange: (patch: Partial<UploadTemplateFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  if (!isOpen) {
    return null;
  }

  const canSubmit = form.title.trim().length > 0 && Boolean(form.file);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Add form</CardTitle>
          <CardDescription>Upload a PDF, then place fields in the DocuSeal builder.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="upload-document-title">Title</Label>
            <Input id="upload-document-title" value={form.title} onChange={(event) => onFormChange({ title: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload-document-category">Category</Label>
            <Input
              id="upload-document-category"
              value={form.category}
              onChange={(event) => onFormChange({ category: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload-document-description">Description</Label>
            <Textarea
              id="upload-document-description"
              value={form.description}
              onChange={(event) => onFormChange({ description: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload-document-file">PDF file</Label>
            <Input
              id="upload-document-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => onFormChange({ file: event.target.files?.[0] ?? null })}
            />
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={!canSubmit || isPending}>
              {isPending ? "Uploading..." : "Open builder"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SendDocumentsModal({
  isOpen,
  form,
  employees,
  templates,
  onFormChange,
  onClose,
  onSubmit,
  isPending,
  errorMessage,
}: {
  isOpen: boolean;
  form: SendFormState;
  employees: OrganizationEmployee[];
  templates: DocumentTemplate[];
  onFormChange: (patch: Partial<SendFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  if (!isOpen) {
    return null;
  }

  const activeTemplates = templates.filter((template) => template.status === "active" && template.builderStatus === "ready" && template.docusealTemplateId);
  const selectedEmployee = employees.find((employee) => employee.id === form.employeeId);
  const canSubmit = form.employeeId.length > 0 && form.templateIds.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Send documents</CardTitle>
          <CardDescription>
            {selectedEmployee ? `Send selected templates to ${selectedEmployee.fullName}.` : "Choose an employee and active templates."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={form.employeeId} onValueChange={(value) => onFormChange({ employeeId: value ?? "" })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select value={form.purpose} onValueChange={(value) => onFormChange({ purpose: value as DocumentPurpose })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee_onboarding">Employee onboarding</SelectItem>
                  <SelectItem value="employee_general">Employee general</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Templates</Label>
            <div className="grid max-h-56 gap-2 overflow-auto rounded-lg border border-border p-3 md:grid-cols-2">
              {activeTemplates.map((template) => {
                const checked = form.templateIds.includes(template.id);

                return (
                  <label key={template.id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={checked}
                      onChange={(event) => {
                        onFormChange({
                          templateIds: event.target.checked
                            ? [...form.templateIds, template.id]
                            : form.templateIds.filter((id) => id !== template.id),
                        });
                      }}
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{template.title}</span>
                      <span className="block text-xs text-muted-foreground">{template.category}</span>
                    </span>
                  </label>
                );
              })}
              {activeTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active templates are available.</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-message-subject">Message subject</Label>
              <Input
                id="document-message-subject"
                value={form.messageSubject}
                onChange={(event) => onFormChange({ messageSubject: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-message-body">Message body</Label>
              <Input
                id="document-message-body"
                value={form.messageBody}
                onChange={(event) => onFormChange({ messageBody: event.target.value })}
              />
            </div>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={!canSubmit || isPending}>
              {isPending ? "Sending..." : "Send documents"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeDocumentDetail({
  organizationId,
  employee,
  onClose,
}: {
  organizationId: string;
  employee: OrganizationEmployee;
  onClose: () => void;
}) {
  const { data: recipients = [], isLoading } = useEmployeeDocuments(organizationId, employee.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-5xl overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{employee.fullName}</CardTitle>
            <CardDescription>{employee.email ?? "No email on file"}</CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-auto">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : recipients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{recipient.template.title}</p>
                      <p className="text-xs text-muted-foreground">{recipient.template.category}</p>
                    </TableCell>
                    <TableCell className="capitalize">{recipient.purpose.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(recipient.status)} className="capitalize">
                        {recipient.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(recipient.sentAt)}</TableCell>
                    <TableCell>{formatDate(recipient.completedAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {recipient.docusealSigningUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(recipient.docusealSigningUrl!, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="size-4" />
                            Sign
                          </Button>
                        ) : null}
                        {recipient.signedDocuments[0]?.documentUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(recipient.signedDocuments[0]!.documentUrl!, "_blank", "noopener,noreferrer")
                            }
                          >
                            <ExternalLink className="size-4" />
                            Signed
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <p className="font-medium text-foreground">No documents sent</p>
              <p className="mt-1 text-sm text-muted-foreground">This employee does not have document history yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExternalSendModal({
  isOpen,
  form,
  templates,
  properties,
  canManageExternal,
  onFormChange,
  onClose,
  onSubmit,
  isPending,
  errorMessage,
}: {
  isOpen: boolean;
  form: ExternalSendFormState;
  templates: DocumentTemplate[];
  properties: DocumentsPanelProps["properties"];
  canManageExternal: boolean;
  onFormChange: (patch: Partial<ExternalSendFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  if (!isOpen) {
    return null;
  }

  const activeTemplates = templates.filter((template) => template.status === "active" && template.builderStatus === "ready" && template.docusealTemplateId);
  const canUseGeneral = canManageExternal;
  const canSubmit =
    form.templateId.length > 0 &&
    form.externalName.trim().length > 0 &&
    form.externalEmail.trim().length > 0 &&
    (form.scope === "general" || form.propertyId.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-hidden">
        <CardHeader>
          <CardTitle>Send external signature</CardTitle>
          <CardDescription>Send one DocuSeal template to a vendor, contractor, owner, or one-time signer.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[72vh] space-y-5 overflow-auto">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={form.templateId} onValueChange={(value) => onFormChange({ templateId: value ?? "" })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={form.scope}
                onValueChange={(value) =>
                  onFormChange({
                    scope: value as ExternalSendFormState["scope"],
                    propertyId: value === "general" ? "" : form.propertyId,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Property</SelectItem>
                  {canUseGeneral ? <SelectItem value="general">General</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            {form.scope === "property" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Property</Label>
                <Select value={form.propertyId} onValueChange={(value) => onFormChange({ propertyId: value ?? "" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="external-name">Name</Label>
              <Input id="external-name" value={form.externalName} onChange={(event) => onFormChange({ externalName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-email">Email</Label>
              <Input
                id="external-email"
                type="email"
                value={form.externalEmail}
                onChange={(event) => onFormChange({ externalEmail: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-company">Company</Label>
              <Input
                id="external-company"
                value={form.externalCompany}
                onChange={(event) => onFormChange({ externalCompany: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-group">Group</Label>
              <Input id="external-group" value={form.externalGroup} onChange={(event) => onFormChange({ externalGroup: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-phone">Phone</Label>
              <Input
                id="external-phone"
                value={form.externalPhone}
                onChange={(event) => onFormChange({ externalPhone: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-message-subject">Message subject</Label>
              <Input
                id="external-message-subject"
                value={form.messageSubject}
                onChange={(event) => onFormChange({ messageSubject: event.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="external-notes">Notes</Label>
              <Textarea id="external-notes" value={form.notes} onChange={(event) => onFormChange({ notes: event.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="external-message-body">Message body</Label>
              <Textarea
                id="external-message-body"
                value={form.messageBody}
                onChange={(event) => onFormChange({ messageBody: event.target.value })}
              />
            </div>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={!canSubmit || isPending}>
              {isPending ? "Sending..." : "Send signature"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExternalRecipientDetail({
  organizationId,
  recipientId,
  properties,
  canManageExternal,
  onClose,
}: {
  organizationId: string;
  recipientId: string;
  properties: DocumentsPanelProps["properties"];
  canManageExternal: boolean;
  onClose: () => void;
}) {
  const { data: recipient, isLoading } = useExternalDocumentRecipient(organizationId, recipientId);
  const patchRecipient = usePatchExternalDocumentRecipient(organizationId);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ExternalEditFormState>({
    externalCompany: "",
    externalGroup: "",
    externalPhone: "",
    scope: "property",
    propertyId: "",
    notes: "",
  });

  useEffect(() => {
    if (!recipient) {
      return;
    }

    setForm({
      externalCompany: recipient.externalCompany ?? "",
      externalGroup: recipient.externalGroup ?? "",
      externalPhone: recipient.externalPhone ?? "",
      scope: recipient.isGeneral ? "general" : "property",
      propertyId: recipient.propertyId ?? "",
      notes: recipient.notes ?? "",
    });
  }, [recipient]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-5xl overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{recipient?.externalName ?? recipient?.signerName ?? "External recipient"}</CardTitle>
            <CardDescription>{recipient?.externalEmail ?? recipient?.signerEmail ?? "Loading signature detail"}</CardDescription>
          </div>
          <div className="flex gap-2">
            {canManageExternal && recipient ? (
              <Button type="button" variant="outline" onClick={() => setIsEditing((value) => !value)}>
                <Pencil className="size-4" />
                {isEditing ? "Cancel edit" : "Edit"}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[72vh] space-y-6 overflow-auto">
          {isLoading || !recipient ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard icon={FileSignature} label="Status" value={formatRecipientStatus(recipient.status)} helper={recipient.template.title} />
                <StatCard icon={Building2} label="Scope" value={recipient.isGeneral ? "General" : recipient.property?.name ?? "Property"} helper="Access boundary" />
                <StatCard icon={Send} label="Sent" value={formatDate(recipient.sentAt)} helper={recipient.externalCompany ?? "No company"} />
                <StatCard icon={Library} label="Signed" value={formatDate(recipient.completedAt)} helper={recipient.externalGroup ?? "No group"} />
              </div>

              {isEditing ? (
                <Card>
                  <CardHeader>
                    <CardTitle>External metadata</CardTitle>
                    <CardDescription>Update local tracking fields without changing the DocuSeal signer.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input value={form.externalCompany} onChange={(event) => setForm((current) => ({ ...current, externalCompany: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Group</Label>
                      <Input value={form.externalGroup} onChange={(event) => setForm((current) => ({ ...current, externalGroup: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={form.externalPhone} onChange={(event) => setForm((current) => ({ ...current, externalPhone: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Scope</Label>
                      <Select
                        value={form.scope}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            scope: value as ExternalEditFormState["scope"],
                            propertyId: value === "general" ? "" : current.propertyId,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="property">Property</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.scope === "property" ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Property</Label>
                        <Select value={form.propertyId} onValueChange={(value) => setForm((current) => ({ ...current, propertyId: value ?? "" }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent>
                            {properties.map((property) => (
                              <SelectItem key={property.id} value={property.id}>
                                {property.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="space-y-2 md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                    </div>
                    {patchRecipient.error ? <p className="text-sm text-destructive md:col-span-2">{patchRecipient.error.message}</p> : null}
                    <div className="flex justify-end gap-3 md:col-span-2">
                      <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={patchRecipient.isPending}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={patchRecipient.isPending || (form.scope === "property" && !form.propertyId)}
                        onClick={() =>
                          patchRecipient.mutate(
                            {
                              organizationId,
                              recipientId: recipient.id,
                              externalCompany: form.externalCompany.trim() || null,
                              externalGroup: form.externalGroup.trim() || null,
                              externalPhone: form.externalPhone.trim() || null,
                              isGeneral: form.scope === "general",
                              propertyId: form.scope === "general" ? null : form.propertyId,
                              notes: form.notes.trim() || null,
                            },
                            { onSuccess: () => setIsEditing(false) }
                          )
                        }
                      >
                        {patchRecipient.isPending ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Signature activity</CardTitle>
                  <CardDescription>DocuSeal and app events for this recipient.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Occurred</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipient.events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{event.eventType}</TableCell>
                          <TableCell className="capitalize">{event.source}</TableCell>
                          <TableCell className="capitalize">{event.processingStatus}</TableCell>
                          <TableCell>{formatDate(event.occurredAt)}</TableCell>
                        </TableRow>
                      ))}
                      {recipient.events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No events recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                {recipient.docusealSigningUrl ? (
                  <Button type="button" variant="outline" onClick={() => window.open(recipient.docusealSigningUrl!, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="size-4" />
                    Signing link
                  </Button>
                ) : null}
                {recipient.signedDocuments[0]?.documentUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(recipient.signedDocuments[0]!.documentUrl!, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="size-4" />
                    Signed document
                  </Button>
                ) : null}
                {recipient.signedDocuments[0]?.auditLogUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(recipient.signedDocuments[0]!.auditLogUrl!, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="size-4" />
                    Audit log
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DocumentsPanel({ organizationId, selectedPropertyId, properties }: DocumentsPanelProps) {
  const navigate = useNavigate();
  const { data: permissionSnapshot } = useOrganizationPermissions(organizationId);
  const { data: templates = [], isLoading: templatesLoading } = useDocumentTemplates(organizationId);
  const { data: recipients = [], isLoading: recipientsLoading } = useDocumentRecipients(organizationId);
  const { data: employees = [], isLoading: employeesLoading } = useOrganizationEmployees(organizationId, selectedPropertyId);
  const createTemplate = useCreateDocumentTemplate(organizationId);
  const cloneSystemTemplate = useCloneSystemDocumentTemplate(organizationId);
  const uploadTemplate = useUploadDocumentTemplate(organizationId);
  const patchTemplate = usePatchDocumentTemplate(organizationId);
  const deleteTemplate = useDeleteDocumentTemplate(organizationId);
  const sendDocuments = useSendEmployeeDocuments(organizationId);
  const sendExternalDocument = useSendExternalDocument(organizationId);
  const [templateSearch, setTemplateSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentTemplateStatus | "all">("all");
  const [libraryTab, setLibraryTab] = useState<"archived" | "org" | "system">("org");
  const [isUploadTemplateModalOpen, setIsUploadTemplateModalOpen] = useState(false);
  const [uploadTemplateForm, setUploadTemplateForm] = useState<UploadTemplateFormState>(emptyUploadTemplateForm);
  const [externalFilters, setExternalFilters] = useState<ExternalDocumentFilters>({
    name: "",
    email: "",
    company: "",
    group: "",
    propertyId: selectedPropertyId ?? null,
    isGeneral: null,
    status: "all",
    templateId: null,
    sentFrom: "",
    sentTo: "",
    signedFrom: "",
    signedTo: "",
  });
  const [templateModalState, setTemplateModalState] = useState<{ mode: "create" | "edit"; template: DocumentTemplate | null } | null>(
    null
  );
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isExternalSendModalOpen, setIsExternalSendModalOpen] = useState(false);
  const [selectedExternalRecipientId, setSelectedExternalRecipientId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [sendForm, setSendForm] = useState<SendFormState>({
    employeeId: "",
    templateIds: [],
    purpose: "employee_onboarding",
    messageSubject: "",
    messageBody: "",
  });
  const [externalSendForm, setExternalSendForm] = useState<ExternalSendFormState>({
    ...emptyExternalSendForm,
    propertyId: selectedPropertyId ?? properties[0]?.id ?? "",
  });

  const canReadTemplates = canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_TEMPLATE_READ);
  const canWriteTemplates = canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE);
  const canDeleteTemplates = canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_TEMPLATE_DELETE);
  const canSendEmployeeDocuments = canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EMPLOYEE_SEND);
  const canReadExternalDocuments = canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EXTERNAL_READ);
  const canSendExternalDocuments = canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EXTERNAL_SEND);
  const canManageExternalDocuments = canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EXTERNAL_MANAGE);
  const { data: externalRecipients = [], isLoading: externalRecipientsLoading } = useExternalDocuments(
    organizationId,
    externalFilters,
    canReadExternalDocuments
  );

  useEffect(() => {
    if (!templateModalState) {
      setTemplateForm(emptyTemplateForm);
      return;
    }

    if (templateModalState.template) {
      setTemplateForm({
        docusealTemplateId: templateModalState.template.docusealTemplateId ?? "",
        title: templateModalState.template.title,
        description: templateModalState.template.description ?? "",
        category: templateModalState.template.category,
        status: templateModalState.template.status,
      });
    } else {
      setTemplateForm(emptyTemplateForm);
    }
  }, [templateModalState]);

  const firstEmployeeId = employees[0]?.id ?? "";
  const firstPropertyId = properties[0]?.id ?? "";

  useEffect(() => {
    if (!firstEmployeeId) {
      return;
    }

    setSendForm((current) => {
      if (current.employeeId) {
        return current;
      }

      return {
        ...current,
        employeeId: firstEmployeeId,
      };
    });
  }, [firstEmployeeId]);

  useEffect(() => {
    const nextPropertyId = selectedPropertyId || firstPropertyId;
    if (!nextPropertyId) {
      return;
    }

    setExternalSendForm((current) => {
      if (current.propertyId) {
        return current;
      }

      return {
        ...current,
        propertyId: nextPropertyId,
      };
    });
  }, [firstPropertyId, selectedPropertyId]);

  useEffect(() => {
    const nextPropertyId = selectedPropertyId ?? null;
    setExternalFilters((current) => {
      const nextIsGeneral = selectedPropertyId ? false : current.isGeneral;
      if (current.propertyId === nextPropertyId && current.isGeneral === nextIsGeneral) {
        return current;
      }

      return {
        ...current,
        propertyId: nextPropertyId,
        isGeneral: nextIsGeneral,
      };
    });
  }, [selectedPropertyId]);

  const filteredTemplates = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesLibraryTab =
        libraryTab === "archived"
          ? template.status === "archived" || template.builderStatus === "archived"
          : libraryTab === "system"
            ? template.sourceType === "system_seeded"
            : template.status !== "archived" && template.builderStatus !== "archived" && template.sourceType !== "system_seeded";
      const matchesStatus = statusFilter === "all" || template.status === statusFilter;
      const matchesSearch =
        search.length === 0 ||
        template.title.toLowerCase().includes(search) ||
        template.category.toLowerCase().includes(search) ||
        (template.docusealTemplateId ?? "").includes(search);

      return matchesLibraryTab && matchesStatus && matchesSearch;
    });
  }, [libraryTab, statusFilter, templateSearch, templates]);

  const employeeRows = useMemo(() => {
    return employees.map((employee) => {
      const employeeRecipients = recipients.filter((recipient) => recipient.employeeId === employee.id);

      return {
        employee,
        total: employeeRecipients.length,
        pending: employeeRecipients.filter((recipient) => recipient.status === "pending" || recipient.status === "sent" || recipient.status === "opened")
          .length,
        completed: employeeRecipients.filter((recipient) => recipient.status === "completed").length,
        declined: employeeRecipients.filter((recipient) => recipient.status === "declined" || recipient.status === "failed").length,
        latest: employeeRecipients[0] ?? null,
      };
    });
  }, [employees, recipients]);
  const selectedEmployee = selectedEmployeeId
    ? employees.find((employee) => employee.id === selectedEmployeeId) ?? null
    : null;
  const sendableTemplateCount = templates.filter(
    (template) => template.status === "active" && template.builderStatus === "ready" && Boolean(template.docusealTemplateId)
  ).length;
  const externalPendingCount = externalRecipients.filter((recipient) => ["pending", "sent", "opened"].includes(recipient.status)).length;
  const externalCompletedCount = externalRecipients.filter((recipient) => recipient.status === "completed").length;

  if (!permissionSnapshot) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  if (!canReadTemplates && !canReadExternalDocuments) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents unavailable</CardTitle>
          <CardDescription>You do not have document access in this organization.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Library} label="Templates" value={formatNumber(templates.length)} helper="Library records" />
        <StatCard
          icon={FileSignature}
          label="Pending"
          value={formatNumber(recipients.filter((recipient) => ["pending", "sent", "opened"].includes(recipient.status)).length + externalPendingCount)}
          helper="Awaiting signatures"
        />
        <StatCard
          icon={Users}
          label="Employees"
          value={formatNumber(employeeRows.filter((row) => row.total > 0).length)}
          helper="With document history"
        />
        <StatCard
          icon={Send}
          label="Completed"
          value={formatNumber(recipients.filter((recipient) => recipient.status === "completed").length + externalCompletedCount)}
          helper="Signed documents"
        />
      </div>

      <Tabs defaultValue={canReadTemplates ? "library" : "external"} className="space-y-6">
        <TabsList>
          {canReadTemplates ? <TabsTrigger value="library">Library</TabsTrigger> : null}
          {canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EMPLOYEE_READ) ? (
            <TabsTrigger value="employees">Employee documents</TabsTrigger>
          ) : null}
          {canReadExternalDocuments ? <TabsTrigger value="external">External signatures</TabsTrigger> : null}
        </TabsList>

        {canReadTemplates ? (
        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Document library</CardTitle>
                <CardDescription>DocuSeal templates available for employee onboarding and general sends.</CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  className="w-full sm:w-64"
                  placeholder="Search templates"
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DocumentTemplateStatus | "all")}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  disabled={!canWriteTemplates}
                  onClick={() => setIsUploadTemplateModalOpen(true)}
                >
                  <Upload className="size-4" />
                  Add form
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={libraryTab} onValueChange={(value) => setLibraryTab(value as "archived" | "org" | "system")} className="mb-4">
                <TabsList>
                  <TabsTrigger value="org">Org Forms</TabsTrigger>
                  <TabsTrigger value="system">System Forms</TabsTrigger>
                  <TabsTrigger value="archived">Archived</TabsTrigger>
                </TabsList>
              </Tabs>
              {templatesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
              ) : filteredTemplates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>DocuSeal ID</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Builder</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{template.title}</p>
                          <p className="text-xs text-muted-foreground">{template.description ?? "No description"}</p>
                        </TableCell>
                        <TableCell>{template.docusealTemplateId ?? "Not created"}</TableCell>
                        <TableCell>{template.category}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(template.status)} className="capitalize">
                            {template.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.builderStatus === "ready" ? "secondary" : "outline"} className="capitalize">
                            {template.builderStatus.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(template.updatedAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {template.sourceType === "system_seeded" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canWriteTemplates || cloneSystemTemplate.isPending}
                                onClick={() => cloneSystemTemplate.mutate({ organizationId, systemTemplateId: template.id })}
                              >
                                Add to Org Library
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!canWriteTemplates}
                                  onClick={() => navigate(`/orgs/${organizationId}/documents/templates/${template.id}/builder`)}
                                >
                                  <Pencil className="size-4" />
                                  Edit in Builder
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!canWriteTemplates}
                                  onClick={() => setTemplateModalState({ mode: "edit", template })}
                                >
                                  Metadata
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!canDeleteTemplates || deleteTemplate.isPending}
                                  onClick={() => {
                                    const confirmed = window.confirm(
                                      `Archive or delete ${template.title}? Sent templates are archived automatically.`
                                    );

                                    if (confirmed) {
                                      deleteTemplate.mutate({ organizationId, templateId: template.id });
                                    }
                                  }}
                                >
                                  <Archive className="size-4" />
                                  Archive
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                  <p className="font-medium text-foreground">No templates found</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add a DocuSeal template reference to begin sending documents.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        ) : null}

        {canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EMPLOYEE_READ) ? (
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Employee documents</CardTitle>
                <CardDescription>Track pending and completed employee signature requests separately from future external signatures.</CardDescription>
              </div>
              <Button
                type="button"
                disabled={!canSendEmployeeDocuments || employees.length === 0 || sendableTemplateCount === 0}
                onClick={() => setIsSendModalOpen(true)}
              >
                <Send className="size-4" />
                Send documents
              </Button>
            </CardHeader>
            <CardContent>
              {employeesLoading || recipientsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
              ) : employeeRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Latest</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeRows.map((row) => (
                      <TableRow key={row.employee.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{row.employee.fullName}</p>
                          <p className="text-xs text-muted-foreground">{row.employee.email ?? "No email"}</p>
                        </TableCell>
                        <TableCell>{formatNumber(row.pending)}</TableCell>
                        <TableCell>{formatNumber(row.completed)}</TableCell>
                        <TableCell>{formatNumber(row.declined)}</TableCell>
                        <TableCell>
                          {row.latest ? (
                            <Badge variant={getStatusVariant(row.latest.status)} className="capitalize">
                              {row.latest.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No sends</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedEmployeeId(row.employee.id)}>
                              Detail
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!canSendEmployeeDocuments}
                              onClick={() => {
                                setSendForm((current) => ({ ...current, employeeId: row.employee.id }));
                                setIsSendModalOpen(true);
                              }}
                            >
                              Send
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                  <p className="font-medium text-foreground">No employees available</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add employees before sending onboarding documents.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        ) : null}

        {canReadExternalDocuments ? (
          <TabsContent value="external" className="space-y-4">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>External signatures</CardTitle>
                    <CardDescription>Track vendor, contractor, owner, and one-time signature requests outside employee files.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    disabled={
                      !canSendExternalDocuments ||
                      sendableTemplateCount === 0 ||
                      (!canManageExternalDocuments && properties.length === 0)
                    }
                    onClick={() => setIsExternalSendModalOpen(true)}
                  >
                    <Send className="size-4" />
                    New external signature
                  </Button>
                </div>
                <div className="grid gap-3 lg:grid-cols-6">
                  <Input
                    placeholder="Name"
                    value={externalFilters.name ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, name: event.target.value }))}
                  />
                  <Input
                    placeholder="Email"
                    value={externalFilters.email ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, email: event.target.value }))}
                  />
                  <Input
                    placeholder="Company"
                    value={externalFilters.company ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, company: event.target.value }))}
                  />
                  <Input
                    placeholder="Group"
                    value={externalFilters.group ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, group: event.target.value }))}
                  />
                  <Select
                    value={externalFilters.status ?? "all"}
                    onValueChange={(value) =>
                      setExternalFilters((current) => ({ ...current, status: value as DocumentRecipientStatus | "all" }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="opened">Viewed</SelectItem>
                      <SelectItem value="completed">Signed</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={externalFilters.isGeneral ? "general" : externalFilters.propertyId ?? "all"}
                    onValueChange={(value) =>
                      setExternalFilters((current) => ({
                        ...current,
                        propertyId: value === "all" || value === "general" ? null : value,
                        isGeneral: value === "general" ? true : value === "all" ? null : false,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All scopes</SelectItem>
                      {canManageExternalDocuments ? <SelectItem value="general">General</SelectItem> : null}
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={externalFilters.templateId ?? "all"}
                    onValueChange={(value) => setExternalFilters((current) => ({ ...current, templateId: value === "all" ? null : value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All templates</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input
                    type="date"
                    value={externalFilters.sentFrom ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, sentFrom: event.target.value }))}
                  />
                  <Input
                    type="date"
                    value={externalFilters.sentTo ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, sentTo: event.target.value }))}
                  />
                  <Input
                    type="date"
                    value={externalFilters.signedFrom ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, signedFrom: event.target.value }))}
                  />
                  <Input
                    type="date"
                    value={externalFilters.signedTo ?? ""}
                    onChange={(event) => setExternalFilters((current) => ({ ...current, signedTo: event.target.value }))}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {externalRecipientsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                  </div>
                ) : externalRecipients.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Signed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {externalRecipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{recipient.externalName ?? recipient.signerName}</p>
                            <p className="text-xs text-muted-foreground">{recipient.externalEmail ?? recipient.signerEmail}</p>
                          </TableCell>
                          <TableCell>
                            <p>{recipient.externalCompany ?? "No company"}</p>
                            <p className="text-xs text-muted-foreground">{recipient.externalGroup ?? "No group"}</p>
                          </TableCell>
                          <TableCell>{recipient.template.title}</TableCell>
                          <TableCell>{recipient.isGeneral ? "General" : recipient.property?.name ?? "Property"}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(recipient.status)} className="capitalize">
                              {formatRecipientStatus(recipient.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(recipient.sentAt)}</TableCell>
                          <TableCell>{formatDate(recipient.completedAt)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedExternalRecipientId(recipient.id)}>
                                Detail
                              </Button>
                              {recipient.docusealSigningUrl ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(recipient.docusealSigningUrl!, "_blank", "noopener,noreferrer")}
                                >
                                  <ExternalLink className="size-4" />
                                  Link
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                    <p className="font-medium text-foreground">No external signatures found</p>
                    <p className="mt-1 text-sm text-muted-foreground">Adjust filters or send a new external signature request.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <TemplateModal
        isOpen={Boolean(templateModalState)}
        mode={templateModalState?.mode ?? "create"}
        form={templateForm}
        onFormChange={(patch) => setTemplateForm((current) => ({ ...current, ...patch }))}
        onClose={() => setTemplateModalState(null)}
        onSubmit={() => {
          const payload = {
            organizationId,
            templateId: templateModalState?.template?.id,
            docusealTemplateId: templateForm.docusealTemplateId.trim(),
            title: templateForm.title.trim(),
            description: templateForm.description.trim() || null,
            category: templateForm.category.trim() || "Onboarding",
            sourceType: "docuseal_created" as const,
            status: templateForm.status,
          };

          const mutation = templateModalState?.mode === "edit" ? patchTemplate : createTemplate;
          mutation.mutate(payload, {
            onSuccess: () => setTemplateModalState(null),
          });
        }}
        isPending={createTemplate.isPending || patchTemplate.isPending}
        errorMessage={createTemplate.error?.message ?? patchTemplate.error?.message ?? null}
      />

      <UploadTemplateModal
        isOpen={isUploadTemplateModalOpen}
        form={uploadTemplateForm}
        onFormChange={(patch) => setUploadTemplateForm((current) => ({ ...current, ...patch }))}
        onClose={() => setIsUploadTemplateModalOpen(false)}
        onSubmit={() => {
          if (!uploadTemplateForm.file) {
            return;
          }

          uploadTemplate.mutate(
            {
              organizationId,
              title: uploadTemplateForm.title.trim(),
              description: uploadTemplateForm.description.trim() || null,
              category: uploadTemplateForm.category.trim() || "Onboarding",
              file: uploadTemplateForm.file,
            },
            {
              onSuccess: (template) => {
                setIsUploadTemplateModalOpen(false);
                setUploadTemplateForm(emptyUploadTemplateForm);
                navigate(`/orgs/${organizationId}/documents/templates/${template.id}/builder`);
              },
            }
          );
        }}
        isPending={uploadTemplate.isPending}
        errorMessage={uploadTemplate.error?.message ?? null}
      />

      <SendDocumentsModal
        isOpen={isSendModalOpen}
        form={sendForm}
        employees={employees}
        templates={templates}
        onFormChange={(patch) => setSendForm((current) => ({ ...current, ...patch }))}
        onClose={() => setIsSendModalOpen(false)}
        onSubmit={() =>
          sendDocuments.mutate(
            {
              organizationId,
              employeeId: sendForm.employeeId,
              templateIds: sendForm.templateIds,
              purpose: sendForm.purpose,
              messageSubject: sendForm.messageSubject.trim() || null,
              messageBody: sendForm.messageBody.trim() || null,
            },
            {
              onSuccess: () => {
                setIsSendModalOpen(false);
                setSendForm({
                  employeeId: employees[0]?.id ?? "",
                  templateIds: [],
                  purpose: "employee_onboarding",
                  messageSubject: "",
                  messageBody: "",
                });
              },
            }
          )
        }
        isPending={sendDocuments.isPending}
        errorMessage={sendDocuments.error?.message ?? null}
      />

      <ExternalSendModal
        isOpen={isExternalSendModalOpen}
        form={externalSendForm}
        templates={templates}
        properties={properties}
        canManageExternal={canManageExternalDocuments}
        onFormChange={(patch) => setExternalSendForm((current) => ({ ...current, ...patch }))}
        onClose={() => setIsExternalSendModalOpen(false)}
        onSubmit={() =>
          sendExternalDocument.mutate(
            {
              organizationId,
              templateId: externalSendForm.templateId,
              externalName: externalSendForm.externalName.trim(),
              externalEmail: externalSendForm.externalEmail.trim(),
              externalCompany: externalSendForm.externalCompany.trim() || null,
              externalGroup: externalSendForm.externalGroup.trim() || null,
              externalPhone: externalSendForm.externalPhone.trim() || null,
              isGeneral: externalSendForm.scope === "general",
              propertyId: externalSendForm.scope === "general" ? null : externalSendForm.propertyId,
              notes: externalSendForm.notes.trim() || null,
              messageSubject: externalSendForm.messageSubject.trim() || null,
              messageBody: externalSendForm.messageBody.trim() || null,
            },
            {
              onSuccess: () => {
                setIsExternalSendModalOpen(false);
                setExternalSendForm({
                  ...emptyExternalSendForm,
                  propertyId: selectedPropertyId ?? properties[0]?.id ?? "",
                });
              },
            }
          )
        }
        isPending={sendExternalDocument.isPending}
        errorMessage={sendExternalDocument.error?.message ?? null}
      />

      {selectedEmployee ? (
        <EmployeeDocumentDetail
          organizationId={organizationId}
          employee={selectedEmployee}
          onClose={() => setSelectedEmployeeId(null)}
        />
      ) : null}

      {selectedExternalRecipientId ? (
        <ExternalRecipientDetail
          organizationId={organizationId}
          recipientId={selectedExternalRecipientId}
          properties={properties}
          canManageExternal={canManageExternalDocuments}
          onClose={() => setSelectedExternalRecipientId(null)}
        />
      ) : null}
    </section>
  );
}
