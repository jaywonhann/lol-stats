# 협곡지표

리그 오브 레전드 챔피언 통계 사이트 (티어 리스트, 빌드, 룬, 카운터).

- 챔피언·아이템·룬·소환사 주문 정보: Riot [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) (API 키 불필요)
- 승률·픽률·빌드 통계: 지금은 `src/lib/mock.ts`의 목업 데이터. Riot API 키가 생기면 이 파일을 실제 집계 데이터로 교체합니다.

## 페이지

- `/` 홈: 라인별 추천 챔피언, 챔피언 검색
- `/tier?lane=mid&rank=diamond` 티어 리스트
- `/champions/Ahri?lane=mid` 챔피언 상세 (룬, 코어템, 시작템, 신발, 스펠, 스킬 순서, 카운터)

## 개발

```bash
npm install
npm run dev   # http://localhost:3000
```

`DDRAGON_BASE` 환경변수로 Data Dragon 주소를 바꿀 수 있어요 (기본값 `https://ddragon.leagueoflegends.com`).

## 배포

Vercel에서 이 저장소를 Import 하면 별도 설정 없이 배포됩니다.

협곡지표 isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
