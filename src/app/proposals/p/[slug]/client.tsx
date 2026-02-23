"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ProposalLandingClientProps {
  slug: string;
  collectBasicInfo: boolean;
  collectInstagram: boolean;
  collectPaypal: boolean;
  collectShipping: boolean;
}

interface FormErrors {
  influencer_name?: string;
  email?: string;
  phone?: string;
  instagram_id?: string;
  paypal_email?: string;
  shipping_name?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_country?: string;
}

export function ProposalLandingClient({
  slug,
  collectBasicInfo,
  collectInstagram,
  collectPaypal,
  collectShipping,
}: ProposalLandingClientProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    influencer_name: "",
    email: "",
    phone: "",
    instagram_id: "",
    paypal_email: "",
    shipping_name: "",
    shipping_address: "",
    shipping_city: "",
    shipping_state: "",
    shipping_zip: "",
    shipping_country: "",
    message: "",
  });

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  }

  const validate = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};

    if (collectBasicInfo) {
      if (!formData.influencer_name.trim()) {
        newErrors.influencer_name = "이름을 입력해주세요";
      }
      if (!formData.email.trim()) {
        newErrors.email = "이메일을 입력해주세요";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = "올바른 이메일 형식을 입력해주세요";
      }
    }

    if (collectInstagram) {
      if (!formData.instagram_id.trim()) {
        newErrors.instagram_id = "인스타그램 아이디를 입력해주세요";
      }
    }

    if (collectPaypal) {
      if (!formData.paypal_email.trim()) {
        newErrors.paypal_email = "페이팔 이메일을 입력해주세요";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.paypal_email.trim())) {
        newErrors.paypal_email = "올바른 이메일 형식을 입력해주세요";
      }
    }

    if (collectShipping) {
      if (!formData.shipping_name.trim()) {
        newErrors.shipping_name = "수령인 이름을 입력해주세요";
      }
      if (!formData.shipping_address.trim()) {
        newErrors.shipping_address = "주소를 입력해주세요";
      }
      if (!formData.shipping_city.trim()) {
        newErrors.shipping_city = "도시를 입력해주세요";
      }
      if (!formData.shipping_country.trim()) {
        newErrors.shipping_country = "국가를 입력해주세요";
      }
    }

    return newErrors;
  }, [formData, collectBasicInfo, collectInstagram, collectPaypal, collectShipping]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);

    try {
      const shippingAddress = collectShipping
        ? {
            name: formData.shipping_name,
            address: formData.shipping_address,
            city: formData.shipping_city,
            state: formData.shipping_state,
            zip: formData.shipping_zip,
            country: formData.shipping_country,
          }
        : null;

      const res = await fetch(`/api/proposals/p/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencer_name: formData.influencer_name || null,
          instagram_id: formData.instagram_id || null,
          email: formData.email || null,
          phone: formData.phone || null,
          paypal_email: formData.paypal_email || null,
          shipping_address: shippingAddress,
          message: formData.message || null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setServerError(data.error || "제출에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    }

    setSubmitting(false);
  }

  /* ====================================================================== */
  /* Success State                                                           */
  /* ====================================================================== */
  if (submitted) {
    return (
      <div className="text-center py-10 sm:py-14">
        {/* Confetti-like celebration */}
        <div className="relative mb-6">
          {/* Decorative particles */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-40 h-40">
              <span className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-primary/60 animate-ping" style={{ animationDelay: "0s", animationDuration: "1.5s" }} />
              <span className="absolute top-1/4 right-0 w-1.5 h-1.5 rounded-full bg-chart-2/60 animate-ping" style={{ animationDelay: "0.2s", animationDuration: "1.8s" }} />
              <span className="absolute bottom-0 left-1/3 w-2 h-2 rounded-full bg-chart-3/60 animate-ping" style={{ animationDelay: "0.4s", animationDuration: "1.3s" }} />
              <span className="absolute top-1/3 left-0 w-1.5 h-1.5 rounded-full bg-chart-4/60 animate-ping" style={{ animationDelay: "0.6s", animationDuration: "1.6s" }} />
              <span className="absolute bottom-1/4 right-1/4 w-2 h-2 rounded-full bg-chart-5/60 animate-ping" style={{ animationDelay: "0.3s", animationDuration: "2s" }} />
              <span className="absolute top-1/2 right-1/3 w-1.5 h-1.5 rounded-full bg-primary/40 animate-ping" style={{ animationDelay: "0.5s", animationDuration: "1.4s" }} />
            </div>
          </div>

          {/* Success icon */}
          <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30 animate-bounce" style={{ animationDuration: "2s" }}>
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h3 className="text-2xl font-bold text-foreground mb-2">
          신청이 완료되었습니다!
        </h3>
        <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
          소중한 신청 감사합니다.<br />
          검토 후 연락드리겠습니다.
        </p>

        {/* Decorative divider */}
        <div className="mt-8 flex items-center justify-center gap-1">
          <span className="w-1 h-1 rounded-full bg-primary/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <span className="w-1 h-1 rounded-full bg-primary/40" />
        </div>
      </div>
    );
  }

  /* ====================================================================== */
  /* Form                                                                    */
  /* ====================================================================== */
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* ---- Basic Info ---- */}
      {collectBasicInfo && (
        <fieldset className="space-y-4">
          <legend className="sr-only">기본 정보</legend>
          <FormField
            label="이름"
            required
            error={errors.influencer_name}
          >
            <Input
              type="text"
              value={formData.influencer_name}
              onChange={(e) => updateField("influencer_name", e.target.value)}
              placeholder="이름을 입력해주세요"
              autoComplete="name"
              aria-invalid={!!errors.influencer_name}
              className="h-11"
            />
          </FormField>

          <FormField
            label="이메일"
            required
            error={errors.email}
          >
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              className="h-11"
            />
          </FormField>

          <FormField label="연락처">
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="010-1234-5678"
              autoComplete="tel"
              className="h-11"
            />
          </FormField>
        </fieldset>
      )}

      {/* ---- Instagram ID ---- */}
      {collectInstagram && (
        <FormField
          label="인스타그램 아이디"
          required
          error={errors.instagram_id}
        >
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium select-none">
              @
            </span>
            <Input
              type="text"
              value={formData.instagram_id}
              onChange={(e) => updateField("instagram_id", e.target.value)}
              placeholder="your_instagram"
              autoComplete="username"
              aria-invalid={!!errors.instagram_id}
              className="pl-8 h-11"
            />
          </div>
        </FormField>
      )}

      {/* ---- PayPal Email ---- */}
      {collectPaypal && (
        <FormField
          label="페이팔 이메일"
          required
          error={errors.paypal_email}
        >
          <Input
            type="email"
            value={formData.paypal_email}
            onChange={(e) => updateField("paypal_email", e.target.value)}
            placeholder="paypal@email.com"
            autoComplete="email"
            aria-invalid={!!errors.paypal_email}
            className="h-11"
          />
        </FormField>
      )}

      {/* ---- Shipping Address ---- */}
      {collectShipping && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            배송 정보
          </legend>

          <FormField
            label="수령인"
            required
            error={errors.shipping_name}
          >
            <Input
              type="text"
              value={formData.shipping_name}
              onChange={(e) => updateField("shipping_name", e.target.value)}
              placeholder="수령인 이름"
              autoComplete="shipping name"
              aria-invalid={!!errors.shipping_name}
              className="h-11"
            />
          </FormField>

          <FormField
            label="주소"
            required
            error={errors.shipping_address}
          >
            <Input
              type="text"
              value={formData.shipping_address}
              onChange={(e) => updateField("shipping_address", e.target.value)}
              placeholder="상세 주소를 입력해주세요"
              autoComplete="shipping street-address"
              aria-invalid={!!errors.shipping_address}
              className="h-11"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="도시"
              required
              error={errors.shipping_city}
            >
              <Input
                type="text"
                value={formData.shipping_city}
                onChange={(e) => updateField("shipping_city", e.target.value)}
                placeholder="도시"
                autoComplete="shipping address-level2"
                aria-invalid={!!errors.shipping_city}
                className="h-11"
              />
            </FormField>
            <FormField label="주/도">
              <Input
                type="text"
                value={formData.shipping_state}
                onChange={(e) => updateField("shipping_state", e.target.value)}
                placeholder="주/도"
                autoComplete="shipping address-level1"
                className="h-11"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="우편번호">
              <Input
                type="text"
                value={formData.shipping_zip}
                onChange={(e) => updateField("shipping_zip", e.target.value)}
                placeholder="우편번호"
                autoComplete="shipping postal-code"
                className="h-11"
              />
            </FormField>
            <FormField
              label="국가"
              required
              error={errors.shipping_country}
            >
              <Input
                type="text"
                value={formData.shipping_country}
                onChange={(e) => updateField("shipping_country", e.target.value)}
                placeholder="국가"
                autoComplete="shipping country-name"
                aria-invalid={!!errors.shipping_country}
                className="h-11"
              />
            </FormField>
          </div>
        </fieldset>
      )}

      {/* ---- Message ---- */}
      <FormField label="메시지 (선택사항)">
        <Textarea
          value={formData.message}
          onChange={(e) => updateField("message", e.target.value)}
          rows={3}
          placeholder="자기소개나 하고 싶은 말을 자유롭게 작성해주세요..."
          className="resize-none min-h-[88px]"
        />
      </FormField>

      {/* ---- Server Error ---- */}
      {serverError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <svg className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-destructive font-medium">{serverError}</p>
        </div>
      )}

      {/* ---- Submit Button ---- */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary to-primary/85 hover:from-primary/95 hover:to-primary/80 disabled:from-muted disabled:to-muted disabled:text-muted-foreground text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] disabled:shadow-none disabled:scale-100 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              제출 중...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              캠페인 신청하기
            </span>
          )}
        </button>

        {/* Already applied note */}
        <p className="text-center text-xs text-muted-foreground mt-3">
          이미 신청하셨나요? 중복 신청은 자동으로 처리됩니다.
        </p>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* FormField helper component                                                  */
/* -------------------------------------------------------------------------- */

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-destructive ml-0.5">*</span>
        )}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
