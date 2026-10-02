import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";

const utilityLinks = [
  { label: "Đăng ký phòng", action: "register" },
  { label: "Thanh toán VietQR", action: "payment" },
  { label: "Nội quy ký túc xá", href: "/#noi-quy" },
  { label: "Báo cáo sự cố", action: "feedback" },
];

export default function AppFooter({ onAction }) {
  const handleAction = (action) => {
    if (onAction) {
      onAction(action);
      return;
    }

    window.location.assign("/login");
  };

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white text-slate-700">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-5 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:gap-10 lg:py-12">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-2xl font-black leading-none tracking-tight">
              <span className="text-blue-600">i</span>
              <span className="text-slate-800">DORM</span>
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            Đại học Công nghệ Thông tin và Truyền thông. Cổng dịch vụ nội trú
            dành cho sinh viên.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Tích hợp AI Xếp phòng &amp; Trợ lý 24/7
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold text-slate-800">
            Tiện ích sinh viên
          </h2>
          <ul className="space-y-3">
            {utilityLinks.map((link) => (
              <li key={link.label}>
                {link.action ? (
                  <button
                    type="button"
                    onClick={() => handleAction(link.action)}
                    className="group inline-flex items-center gap-1 text-left text-sm text-slate-600 transition-colors hover:text-blue-600"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ) : (
                  <a
                    href={link.href}
                    className="group inline-flex items-center gap-1 text-sm text-slate-600 transition-colors hover:text-blue-600"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold text-slate-800">
            Giờ đóng / mở cổng
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-slate-600">Mùa hè</p>
                <p className="font-semibold text-slate-800">05:00 – 23:00</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-slate-600">Mùa đông</p>
                <p className="font-semibold text-slate-800">05:30 – 22:30</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold text-slate-800">
            Đường dây nóng
          </h2>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>Đường Z115, phường Quyết Thắng, thành phố Thái Nguyên</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="h-4 w-4 shrink-0 text-blue-600" />
              <a
                className="transition-colors hover:text-blue-600"
                href="tel:02083846254"
              >
                0208 3846 254
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-blue-600" />
              <a
                className="transition-colors hover:text-blue-600"
                href="mailto:ktx@ictu.edu.vn"
              >
                ktx@ictu.edu.vn
              </a>
            </li>
          </ul>
        </section>
      </div>
      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-[1600px] px-5 py-4 text-xs text-slate-500 sm:px-8">
          © {new Date().getFullYear()} iDORM · Hệ thống ký túc xá sinh viên
        </p>
      </div>
    </footer>
  );
}
