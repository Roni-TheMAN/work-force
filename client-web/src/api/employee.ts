import { apiRequest } from "@/lib/api";

export type OrganizationEmployee = {
  id: string;
  organizationId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  employmentStatus: string;
  kioskPinConfigured: boolean;
  kioskPinLastSetAt: string | null;
  hasLogin: boolean;
  user: {
    id: string;
    email: string;
  } | null;
  properties: Array<{
    id: string;
    name: string;
    isPrimary: boolean;
    activeFrom: string | null;
    activeTo: string | null;
    role: {
      id: string;
      key: "manager" | "property_admin" | "scheduler" | "viewer";
      displayName: string;
    } | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type EmployeePinMode = "auto" | "manual";

export type CreatePropertyEmployeePayload = {
  propertyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  createLoginAccount: boolean;
  loginPassword: string | null;
  propertyRole: "manager" | "property_admin" | "scheduler" | "viewer";
  pinMode: EmployeePinMode;
  manualPin: string | null;
};

export type EmployeePinReveal = {
  value: string;
  mode?: EmployeePinMode | null;
  assignedAt: string | null;
};

export type CreatePropertyEmployeeResult = {
  employee: OrganizationEmployee & { propertyId: string };
  pinReveal: EmployeePinReveal | null;
};

export type EmployeePropertyAssignmentPayload = {
  organizationId: string;
  employeeId: string;
  propertyId: string;
  roleId: string | null;
  isPrimary?: boolean;
};

export type UpdateEmployeePropertyAssignmentPayload = {
  organizationId: string;
  employeeId: string;
  propertyId: string;
  roleId?: string | null;
  isPrimary?: boolean;
};

export type RemoveEmployeePropertyAssignmentPayload = {
  organizationId: string;
  employeeId: string;
  propertyId: string;
};

export type RemoveEmployeePropertyAssignmentResult = {
  mode: "deleted" | "ended";
  activeTo: string | null;
};

export type EmployeePinMutationPayload = {
  organizationId: string;
  employeeId: string;
};

export type ResetEmployeePinPayload = EmployeePinMutationPayload & {
  pinMode: EmployeePinMode;
  manualPin: string | null;
};

export async function fetchOrganizationEmployees(
  organizationId: string,
  propertyId?: string | null,
  signal?: AbortSignal
): Promise<OrganizationEmployee[]> {
  const searchParams = new URLSearchParams();

  if (propertyId) {
    searchParams.set("propertyId", propertyId);
  }

  const response = await apiRequest<{ employees: OrganizationEmployee[] }>(
    `/api/client/organizations/${encodeURIComponent(organizationId)}/employees${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ""
    }`,
    {
      auth: true,
      signal,
    }
  );

  return response.employees;
}

export async function createPropertyEmployee(payload: CreatePropertyEmployeePayload): Promise<CreatePropertyEmployeeResult> {
  return apiRequest<CreatePropertyEmployeeResult>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/employees`,
    {
      auth: true,
      method: "POST",
      body: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        employeeCode: payload.employeeCode,
        createLoginAccount: payload.createLoginAccount,
        loginPassword: payload.loginPassword,
        propertyRole: payload.propertyRole,
        pinMode: payload.pinMode,
        manualPin: payload.manualPin,
      },
    }
  );
}

export async function addEmployeePropertyAssignment(payload: EmployeePropertyAssignmentPayload) {
  const response = await apiRequest<{
    assignment: {
      employeeId: string;
      property: {
        id: string;
        name: string;
      };
      isPrimary: boolean;
      role: {
        id: string;
        key: "manager" | "property_admin" | "scheduler" | "viewer";
        displayName: string;
      } | null;
    };
  }>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/employees/${encodeURIComponent(payload.employeeId)}/properties`,
    {
      auth: true,
      method: "POST",
      body: {
        propertyId: payload.propertyId,
        roleId: payload.roleId,
        isPrimary: payload.isPrimary,
      },
    }
  );

  return response.assignment;
}

export async function updateEmployeePropertyAssignment(payload: UpdateEmployeePropertyAssignmentPayload) {
  const response = await apiRequest<{
    assignment: {
      employeeId: string;
      property: {
        id: string;
        name: string;
      };
      isPrimary: boolean;
      role: {
        id: string;
        key: "manager" | "property_admin" | "scheduler" | "viewer";
        displayName: string;
      } | null;
    };
  }>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/employees/${encodeURIComponent(payload.employeeId)}/properties/${encodeURIComponent(payload.propertyId)}`,
    {
      auth: true,
      method: "PATCH",
      body: {
        roleId: payload.roleId,
        isPrimary: payload.isPrimary,
      },
    }
  );

  return response.assignment;
}

export async function removeEmployeePropertyAssignment(payload: RemoveEmployeePropertyAssignmentPayload) {
  return apiRequest<RemoveEmployeePropertyAssignmentResult>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/employees/${encodeURIComponent(payload.employeeId)}/properties/${encodeURIComponent(payload.propertyId)}`,
    {
      auth: true,
      method: "DELETE",
    }
  );
}

export async function archiveEmployee(payload: EmployeePinMutationPayload) {
  const response = await apiRequest<{
    employee: {
      id: string;
      employmentStatus: string;
      terminatedAt: string;
    };
  }>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/employees/${encodeURIComponent(payload.employeeId)}/archive`,
    {
      auth: true,
      method: "POST",
    }
  );

  return response.employee;
}

export async function deleteEmployee(payload: EmployeePinMutationPayload) {
  await apiRequest<void>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/employees/${encodeURIComponent(payload.employeeId)}`,
    {
      auth: true,
      method: "DELETE",
    }
  );
}

export async function revealEmployeePin(payload: EmployeePinMutationPayload): Promise<EmployeePinReveal> {
  const response = await apiRequest<{ pinReveal: EmployeePinReveal }>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/employees/${encodeURIComponent(payload.employeeId)}/pin/reveal`,
    {
      auth: true,
      method: "POST",
    }
  );

  return response.pinReveal;
}

export async function resetEmployeePin(payload: ResetEmployeePinPayload): Promise<EmployeePinReveal> {
  const response = await apiRequest<{ pinReveal: EmployeePinReveal }>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/employees/${encodeURIComponent(payload.employeeId)}/pin/reset`,
    {
      auth: true,
      method: "POST",
      body: {
        pinMode: payload.pinMode,
        manualPin: payload.manualPin,
      },
    }
  );

  return response.pinReveal;
}
