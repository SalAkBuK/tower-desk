import { redirect } from "next/navigation";

export default function OwnersPage() {
    redirect("/admin/residents");
}

/*
"use client";

import { useState } from "react";
import { Building2, Mail, MapPin, Phone, Plus, UserRound, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateOwner, useOwners } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Legacy Owners directory UI intentionally hidden (not deleted).
export default function OwnersPage() {
    const { data: owners, isLoading, error } = useOwners();
    const createOwner = useCreateOwner();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    // ...rest of previous implementation...
}
*/
