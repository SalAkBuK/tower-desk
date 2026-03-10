"use client";

import LeaseDetailPage from "../../leases/[leaseId]/page";

interface AdminContractDetailPageProps {
    params: Promise<{ contractId: string }>;
}

export default function AdminContractDetailPage({ params }: AdminContractDetailPageProps) {
    const mappedParams = params.then(({ contractId }) => ({ leaseId: contractId }));
    return <LeaseDetailPage params={mappedParams} />;
}
