# -*- coding: utf-8 -*-
"""DealMai business introduction PDF for payment partners."""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable, ListFlowable, ListItem,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

OUT = Path(r"D:\Delopment\Dealmai\docs\DealMai_Business_Introduction_Payment_Partner.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
pdfmetrics.registerFont(TTFont("MalgunBold", r"C:\Windows\Fonts\malgunbd.ttf"))

TEAL = HexColor("#0a7a86")
TEAL_DARK = HexColor("#065560")
MAGENTA = HexColor("#b01f7a")
INK = HexColor("#1a1a1a")
MUTED = HexColor("#555555")
LINE = HexColor("#d8d2c8")
BG_SOFT = HexColor("#f4f7f8")
ACCENT_BG = HexColor("#e8f6f8")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


def styles():
    return {
        "cover_brand": ParagraphStyle(
            "cover_brand", fontName="MalgunBold", fontSize=28, textColor=white,
            alignment=TA_CENTER, leading=34, spaceAfter=6,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", fontName="Malgun", fontSize=12, textColor=HexColor("#d7f3f6"),
            alignment=TA_CENTER, leading=18, spaceAfter=4,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta", fontName="Malgun", fontSize=10, textColor=HexColor("#cfe8ec"),
            alignment=TA_CENTER, leading=14,
        ),
        "h1": ParagraphStyle(
            "h1", fontName="MalgunBold", fontSize=14, textColor=TEAL_DARK,
            spaceBefore=14, spaceAfter=8, leading=20,
        ),
        "h2": ParagraphStyle(
            "h2", fontName="MalgunBold", fontSize=11.5, textColor=TEAL,
            spaceBefore=10, spaceAfter=5, leading=16,
        ),
        "body": ParagraphStyle(
            "body", fontName="Malgun", fontSize=9.5, textColor=INK,
            alignment=TA_JUSTIFY, leading=15, spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "bullet", fontName="Malgun", fontSize=9.5, textColor=INK,
            leading=14.5, leftIndent=2, spaceAfter=2,
        ),
        "note": ParagraphStyle(
            "note", fontName="Malgun", fontSize=8.5, textColor=MUTED,
            leading=12, spaceAfter=4,
        ),
        "footer": ParagraphStyle(
            "footer", fontName="Malgun", fontSize=8, textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "toc": ParagraphStyle(
            "toc", fontName="Malgun", fontSize=10, textColor=INK,
            leading=18, leftIndent=8,
        ),
        "table_h": ParagraphStyle(
            "table_h", fontName="MalgunBold", fontSize=9, textColor=white,
            alignment=TA_CENTER, leading=12,
        ),
        "table_c": ParagraphStyle(
            "table_c", fontName="Malgun", fontSize=8.5, textColor=INK,
            leading=12,
        ),
        "table_c_c": ParagraphStyle(
            "table_c_c", fontName="Malgun", fontSize=8.5, textColor=INK,
            alignment=TA_CENTER, leading=12,
        ),
    }


def draw_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(TEAL)
    canvas.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Malgun", 8)
    canvas.drawString(MARGIN, PAGE_H - 6.5 * mm, "DealMai · AI Sales Agent SaaS")
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 6.5 * mm, "Payment Partner Brief")

    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Malgun", 8)
    canvas.drawString(MARGIN, 9 * mm, "Confidential · For payment partner review only")
    canvas.drawRightString(PAGE_W - MARGIN, 9 * mm, f"{doc.page}")
    canvas.restoreState()


def cover_page(story, S):
    # Spacer for visual block drawn via table
    data = [[
        Paragraph("DealMai", S["cover_brand"]),
    ], [
        Paragraph("AI Sales Agent / AI 챗봇 영업·결제 플랫폼", S["cover_sub"]),
    ], [
        Paragraph("사업 소개서 (결제사 제출용)", S["cover_sub"]),
    ], [
        Spacer(1, 8),
    ], [
        Paragraph(
            "서비스 URL: https://dealmai.com<br/>"
            "대상 시장: 일본 · 태국 (운영 중) / 한국 (서비스 준비 중)<br/>"
            "문서 용도: 결제 제휴·심사 참고 자료",
            S["cover_meta"],
        ),
    ]]
    t = Table(data, colWidths=[PAGE_W - 2 * MARGIN - 8 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_DARK),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, 0), 22),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 18),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(Spacer(1, 28 * mm))
    story.append(t)
    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph(
        "본 문서는 DealMai(딜마이) 서비스의 사업 개요, 수익 구조, 주요 마케팅 채널 및 "
        "향후 사업 방향을 결제 파트너사에 간략히 설명하기 위해 작성되었습니다.",
        S["body"],
    ))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("<b>목차</b>", S["h2"]))
    for line in [
        "1. 사업 설명 (서비스 설명)",
        "2. 수익 구조",
        "3. 주요 마케팅 채널 및 적합 업종",
        "4. 향후 사업 진행 방향",
    ]:
        story.append(Paragraph(f"· {line}", S["toc"]))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "작성일: 2026년 9월 &nbsp;&nbsp;|&nbsp;&nbsp; 버전: 1.0 &nbsp;&nbsp;|&nbsp;&nbsp; 언어: 한국어",
        S["note"],
    ))


def section_1(story, S):
    story.append(Paragraph("1. 사업 설명 (서비스 설명)", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.8, color=TEAL, spaceAfter=8))

    story.append(Paragraph("1.1 개요", S["h2"]))
    story.append(Paragraph(
        "DealMai는 <b>AI 세일즈 에이전트(AI Sales Agent) SaaS</b>입니다. "
        "사업자가 웹사이트·랜딩페이지에 AI 챗봇을 연동하여, 고객 상담부터 상품 안내, "
        "<b>예약·패키지 안내, 온라인 결제</b>까지 이어지는 영업 흐름을 자동화·지원합니다.",
        S["body"],
    ))
    story.append(Paragraph(
        "고객은 패키지(크레딧·일회성·구독형)를 구매하고, 결제 완료 후 계정·워크스페이스(DM Champ 기반 AI 챗봇 환경)가 "
        "자동으로 개설됩니다. 직접 결제(결제 PG)와 파트너 채널(제휴 판매 웹훅)을 모두 지원하며, "
        "영어·태국어·일본어·한국어 다국어 UI를 제공합니다.",
        S["body"],
    ))

    bullets = [
        "핵심 가치: ‘상담 → 제안 → 결제 → 계정 발급’을 하나의 디지털 영업 파이프로 연결",
        "제공 형태: 클라우드 SaaS (웹 포털 + 관리자 콘솔 + AI 챗봇 워크스페이스)",
        "결제 흐름: 직접 결제(PG) 및 파트너 판매 연동(웹훅)으로 주문·정산·계정 프로비저닝",
        "운영 시장: 일본·태국 중심 운영 / 한국은 서비스 준비 단계",
    ]
    for b in bullets:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Paragraph("1.2 장점", S["h2"]))
    for b in [
        "24시간 응대가 가능한 AI 챗봇으로 인건비 대비 상담·판매 처리량 확대",
        "예약·패키지·크레딧형 상품처럼 ‘설명 후 결제’가 필요한 상품에 적합",
        "결제 완료와 동시에 계정·챗봇 워크스페이스 자동 발급으로 이탈·수작업 감소",
        "다국어(일/태/한/영)로 국가별 고객 접점 확장에 유리",
        "관리자 콘솔에서 패키지·주문·파트너·결제 이벤트·브랜딩을 일원화 관리",
        "오픈마켓형 중개 수수료 구조가 아니라, 자체 고객·자체 브랜드로 관계 유지 가능",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Paragraph("1.3 단점 및 한계 (리스크 인식)", S["h2"]))
    for b in [
        "AI 답변 품질·가드레일 설정에 따라 고객 경험이 좌우됨 (운영·튜닝 필요)",
        "결제·본인확인·환불·차지백 등 PG/규제 요건을 국가별로 충족해야 함",
        "물리 상품 물류·재고형 오픈마켓과 달리, 디지털/서비스형 상품에 최적화",
        "한국 시장은 아직 준비 단계로, 초기에는 일본·태국 트래픽·매출 비중이 큼",
        "파트너 채널 의존 시 제휴사 정책·정산 일정에 영향을 받을 수 있음",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Paragraph("1.4 기존 오픈마켓·일반 쇼핑몰과의 차이점", S["h2"]))

    header = [
        Paragraph("구분", S["table_h"]),
        Paragraph("오픈마켓 / 일반 쇼핑몰", S["table_h"]),
        Paragraph("DealMai", S["table_h"]),
    ]
    rows = [
        ["판매 주체", "플랫폼 또는 입점 셀러의 상품 나열", "사업자 브랜드의 AI 영업·결제 경험"],
        ["핵심 기능", "검색·장바구니·배송", "상담·추천·예약/패키지 안내·즉시 결제"],
        ["상품 성격", "실물·다품종 SKU 중심", "디지털 구독·크레딧·예약성 서비스 중심"],
        ["고객 접점", "상품 페이지 중심", "AI 챗봇 + 웹 포털 중심"],
        ["수수료 구조", "중개·광고·풀필먼트 수수료", "SaaS 이용료·패키지 판매·크레딧 매출"],
        ["데이터 소유", "플랫폼 정책에 종속", "자사 고객·주문·상담 맥락 보유"],
        ["결제 목적", "상품 대금 결제", "서비스 이용권·크레딧·예약금 등 디지털 결제"],
    ]
    data = [header] + [
        [Paragraph(a, S["table_c_c"]), Paragraph(b, S["table_c"]), Paragraph(c, S["table_c"])]
        for a, b, c in rows
    ]
    tbl = Table(data, colWidths=[28 * mm, 65 * mm, 70 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("BACKGROUND", (0, 1), (-1, -1), BG_SOFT),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, ACCENT_BG]),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "요약하면, DealMai는 ‘물건을 진열해 파는 마켓’이 아니라 "
        "<b>AI가 판매 상담을 수행하고 결제·서비스 개통까지 연결하는 B2B2C형 디지털 영업 인프라</b>입니다.",
        S["body"],
    ))


def section_2(story, S):
    story.append(Paragraph("2. 수익 구조", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.8, color=TEAL, spaceAfter=8))

    story.append(Paragraph(
        "DealMai의 매출은 본질적으로 <b>디지털 서비스·이용권(패키지) 판매</b>와 "
        "<b>AI 챗봇 운영에 필요한 크레딧/구독</b>에서 발생합니다. "
        "실물 재고 매입·물류 마진 구조가 아닙니다.",
        S["body"],
    ))

    story.append(Paragraph("2.1 주요 수익원", S["h2"]))
    for b in [
        "패키지 판매 대금: 크레딧형 / 일회성 / 구독형 플랜의 고객 결제액",
        "반복 구매·크레딧 충전: 사용량 기반 추가 구매(리필) 매출",
        "파트너 채널 판매: 제휴·에이전시 경로로 유입된 주문의 정산 매출",
        "(향후) 부가 기능·상위 플랜·화이트라벨/에이전시 요금제 확대 가능",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Paragraph("2.2 결제·정산 관점", S["h2"]))
    for b in [
        "고객 → PG(또는 파트너 결제) → DealMai 주문 확정 → 서비스/계정 자동 개통",
        "결제 수단·통화는 시장별로 상이 (예: 태국 로컬 PG, 파트너 경유 다통화 등)",
        "환불·부분환불·실패 이벤트는 시스템 웹훅/콜백으로 기록·후속 처리",
        "비용 측면: PG 수수료, 클라우드/인프라, AI·챗봇 공급 비용, 고객지원, 마케팅",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Paragraph("2.3 수익 모델 특징 (결제사 참고)", S["h2"]))
    for b in [
        "고빈도 소액~중액의 디지털 결제 성격 (구독·크레딧 충전 중심)",
        "실물 배송 없는 서비스형 거래 → 물류 클레임보다 계정/이용권 이슈 비중이 큼",
        "정상 결제 완료 시 즉각 서비스 제공으로 가맹점 이행 책임이 명확",
        "국가별 확장 시 동일 SaaS 코어에 결제·언어·컴플라이언스만 지역화",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))


def section_3(story, S):
    story.append(Paragraph("3. 주요 마케팅 채널 및 적합 업종", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.8, color=TEAL, spaceAfter=8))

    story.append(Paragraph(
        "현재 <b>일본·태국</b>을 중심으로 서비스를 운영·확장하고 있으며, "
        "<b>한국은 서비스 준비 중</b>입니다. 마케팅은 ‘대규모 불특정 오픈마켓 광고’보다 "
        "<b>AI 챗봇으로 상담·예약·결제가 자연스러운 업종</b>의 사업자·에이전시를 타깃합니다.",
        S["body"],
    ))

    story.append(Paragraph("3.1 시장별 채널 방향", S["h2"]))
    header = [
        Paragraph("시장", S["table_h"]),
        Paragraph("상태", S["table_h"]),
        Paragraph("주요 채널·접근", S["table_h"]),
    ]
    rows = [
        ["일본", "운영·확장", "로컬 파트너/에이전시, SaaS·DX 커뮤니티, 업종별 세미나·데모, 검색·콘텐츠(일문), 기존 고객 리퍼럴"],
        ["태국", "운영·확장", "로컬 PG·파트너 연동, 에이전시/리셀러, 업종 단체·워크숍, SNS·메신저 기반 리드, 태국어 랜딩"],
        ["한국", "준비 중", "가맹·결제·약관 준비, 파일럿 업종 선정, 파트너십 사전 협의 후 정식 오픈 예정"],
    ]
    data = [header] + [
        [Paragraph(a, S["table_c_c"]), Paragraph(b, S["table_c_c"]), Paragraph(c, S["table_c"])]
        for a, b, c in rows
    ]
    tbl = Table(data, colWidths=[22 * mm, 28 * mm, 113 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, ACCENT_BG]),
    ]))
    story.append(tbl)

    story.append(Paragraph("3.2 AI 챗봇·예약·결제 상품 판매에 적합한 업종", S["h2"]))
    story.append(Paragraph(
        "아래 업종은 ‘상담이 필요하고, 표준화된 상품/패키지가 있으며, 온라인으로 예약금·이용권·회차권을 "
        "결제하기 쉬운’ 특성을 가집니다. DealMai의 AI 세일즈 에이전트와 궁합이 좋습니다.",
        S["body"],
    ))

    header2 = [
        Paragraph("업종", S["table_h"]),
        Paragraph("적합 사유", S["table_h"]),
        Paragraph("결제·상품 예시", S["table_h"]),
    ]
    rows2 = [
        ["미용·뷰티·클리닉", "상담 후 시술/코스 선택, 야간 문의 多", "시술 패키지, 예약금, 멤버십"],
        ["교육·학원·온라인강의", "커리큘럼 안내→등록 전환이 핵심", "수강권, 월정액, 크레딧"],
        ["헬스·필라테스·웰니스", "체험·회원권 상담이 반복적", "회원권, PT 패키지, 이용권"],
        ["여행·투어·액티비티", "일정·옵션 문의 후 예약 결제", "투어 예약금, 옵션 추가금"],
        ["숙박·민박·소규모 호텔", "빈방·요금·옵션 FAQ가 정형화", "숙박 예약, 조식/옵션"],
        ["전문 서비스(법률·세무·컨설팅)", "초기 상담 자동화 + 유료 전환", "상담권, 리테이너, 패키지"],
        ["IT·SaaS·디지털 구독", "플랜 비교·업그레이드 안내", "월/연 구독, 크레딧 충전"],
        ["이벤트·티켓·워크숍", "일정·좌석·조기등록 안내", "참가비, Early-bird"],
        ["렌탈·구독형 생활서비스", "요금제·약정 설명 후 결제", "월 구독, 보증/개시 비용"],
        ["B2B 에이전시·리셀러", "다계정·화이트라벨 판매", "에이전시 패키지, 크레딧 일괄"],
    ]
    data2 = [header2] + [
        [Paragraph(a, S["table_c"]), Paragraph(b, S["table_c"]), Paragraph(c, S["table_c"])]
        for a, b, c in rows2
    ]
    tbl2 = Table(data2, colWidths=[42 * mm, 68 * mm, 53 * mm])
    tbl2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, ACCENT_BG]),
    ]))
    story.append(tbl2)

    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("3.3 채널 운영 원칙", S["h2"]))
    for b in [
        "업종별 데모 봇·성공 사례로 ‘상담→결제’ 전환을 증명",
        "파트너/에이전시 중심 확장으로 현지 영업·지원 효율화 (일·태)",
        "유료 광고는 검증된 업종·랜딩에 집중하여 CAC 관리",
        "한국 오픈 시에는 파일럿 업종 + 결제/본인확인 요건을 선행 충족",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))


def section_4(story, S):
    story.append(Paragraph("4. 향후 사업 진행 방향", S["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.8, color=TEAL, spaceAfter=8))

    story.append(Paragraph("4.1 단기 (인프라·안정화)", S["h2"]))
    for b in [
        "서비스 인프라를 자체 통제 가능한 서버 환경으로 이전·고도화 (가용성·보안·운영 효율)",
        "결제·웹훅·정산·알림 파이프라인 안정화 및 모니터링 강화",
        "일본·태국 운영 품질 고도화 (다국어·현지 결제·고객지원)",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Paragraph("4.2 중기 (상품·채널 확장)", S["h2"]))
    for b in [
        "업종 템플릿(뷰티/교육/예약업 등) 확대로 온보딩 시간 단축",
        "에이전시·리셀러 프로그램 강화로 파트너 매출 비중 확대",
        "예약·크레딧·구독 상품의 자동 갱신·리마인드·재구매 기능 고도화",
        "한국 시장 파일럿 → 정식 서비스 (결제사·약관·고객응대 체계 완비 후)",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Paragraph("4.3 장기 (플랫폼화)", S["h2"]))
    for b in [
        "AI 세일즈 에이전트를 ‘국가·업종·브랜드’ 단위로 확장 가능한 플랫폼으로 발전",
        "화이트라벨·엔터프라이즈 기능 (권한, 감사로그, SLA) 강화",
        "결제·정산·세무 리포팅 등 가맹점 운영 편의 기능 확장",
        "컴플라이언스·보안 인증을 병행하여 대형 가맹·결제 파트너십 확대",
    ]:
        story.append(Paragraph(f"• {b}", S["bullet"]))

    story.append(Spacer(1, 6 * mm))
    box = Table([[Paragraph(
        "<b>결제 파트너사에 드리는 요약</b><br/><br/>"
        "DealMai는 실물 오픈마켓이 아닌, <b>AI 챗봇 기반의 디지털 영업·예약·결제 SaaS</b>입니다. "
        "현재 일본·태국에서 서비스·판매가 이루어지고 있으며 한국은 준비 중입니다. "
        "거래 성격은 주로 패키지·구독·크레딧 등 <b>서비스형 온라인 결제</b>이며, "
        "결제 완료 후 계정/서비스가 자동 개통되는 구조입니다. "
        "안정적인 PG 제휴를 통해 다국가 결제 수용력과 고객 신뢰도를 높이는 것이 "
        "본 사업의 핵심 성장 과제입니다.",
        S["body"],
    )]], colWidths=[PAGE_W - 2 * MARGIN - 4 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_BG),
        ("BOX", (0, 0), (-1, -1), 1, TEAL),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(box)

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "문의: https://dealmai.com &nbsp;&nbsp;|&nbsp;&nbsp; "
        "본 자료는 결제 제휴 검토를 위한 사업 개요이며, 세부 재무·계약 조건은 별도 협의 자료로 제공합니다.",
        S["note"],
    ))


def main():
    S = styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="DealMai 사업 소개서 (결제사 제출용)",
        author="DealMai",
    )
    story = []
    cover_page(story, S)
    section_1(story, S)
    section_2(story, S)
    section_3(story, S)
    section_4(story, S)
    doc.build(story, onFirstPage=draw_header_footer, onLaterPages=draw_header_footer)
    print(OUT)
    print("bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()
