# 계절별 열차 SVG

참고 이미지: `asset/calender/`의 열차 4장. 원본 도면을 트레이싱하지 않고 색 배치와 앞머리 특징을 단순화한 측면 일러스트다.

| 계절 | 파일 | 특징 |
|---|---|---|
| 봄 | train-spring.svg | 빨강, 짙은 회색 하단, 둥근 앞머리 |
| 여름 | train-summer.svg | 하늘색, 노란 물결, 길고 뾰족한 앞머리 |
| 가을 | train-autumn.svg | 은색, 앞머리 상단 파랑, 유선형 |
| 겨울 | train-winter.svg | 은색, 파란 문과 앞면 패널, 각진 앞머리 |

공통 사양: `viewBox="0 0 480 120"`, 차체 바닥선 y=94, 바퀴 중심 y=96, 바퀴 반지름 8, 선 두께 2. 객차 1량과 오른쪽을 향한 앞차 1량, 바퀴 4개. 외부 리소스, 배경, 레일, 그림자, 로고 및 차량 글자 없음. 160×40px로 표시할 수 있다.

`preview.html`을 열면 네 SVG와 40px 축소본을 나란히 확인하고 밝은/어두운 배경을 전환할 수 있다. 좁은 화면에서는 가로 스크롤로 네 종류를 비교한다.

## carbon.html 삽입 예시

현재 `carbon.html`의 상단 카드는 `asset/train_model/`의 PNG 5개를 사용한다. 봄은 ITX-마음, 여름은 KTX-청룡, 가을은 KTX-산천, 겨울은 광역전철이며 열차 선택 메뉴에서 추가 KTX를 포함한 5종을 모두 재생할 수 있다. 원본 이미지의 투명 여백은 CSS 표시 영역에서만 줄인다.

아래는 독립 SVG를 사용하는 삽입 예시다. PNG 모델을 사용하려면 `data-train-base` 대신 `data-train-model-base="asset/train_model/"`를 지정한다. `preview.html`의 SVG 비교 화면은 그대로 유지한다.

head에 다음을 추가한다.

```html
<link rel="stylesheet" href="asset/seasonal-trains/seasonal-trains.css">
<script defer src="asset/seasonal-trains/seasonal-trains.js"></script>
```

카드 안에 다음을 넣는다. 탭은 스크립트가 접근성 상태와 함께 생성한다.

```html
<div class="seasonal-train-demo" data-seasonal-train
     data-train-base="asset/seasonal-trains/">
  <div class="train-season-tabs" role="group" aria-label="열차 계절 선택"></div>
  <div class="train-lane">
    <div class="train-runner">
      <img src="asset/seasonal-trains/train-spring.svg"
           width="160" height="40" alt="봄 열차">
    </div>
  </div>
</div>
```

기본 계절은 한국 시간의 현재 월로 선택한다. 탭을 누르면 해당 SVG를 불러온 뒤 CSS 애니메이션으로 왼쪽 바깥부터 오른쪽 바깥까지 3초 동안 한 번 이동한다. 같은 탭을 다시 눌러도 재생된다. 빠르게 탭을 변경하면 마지막 선택만 재생한다.

```css
.train-runner { width: 100%; transform: translateX(-160px); }
.train-runner img { width: 160px; height: 40px; }
.train-runner.is-running { animation: seasonal-train-pass 3s linear both; }
@keyframes seasonal-train-pass {
  from { transform: translateX(-160px); }
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .train-runner, .train-runner.is-running {
    animation: none;
    transform: none;
    display: flex;
    justify-content: center;
  }
}
```

범위가 `.seasonal-train-demo`로 제한된 전체 CSS는 `seasonal-trains.css`를 사용한다. 기존 페이지의 라이트/다크 모드를 그대로 사용할 수 있도록 열차에는 고정된 차체 색과 외곽선을 사용했다.
