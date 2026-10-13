/*
 *   Copyright (c) 2024-2026. caoccao.com Sam Cao
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import type { MouseEvent } from 'react';
import { ListItemIcon, ListItemText, MenuItem } from '@mui/material';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import {
  GridAutosizeOptions,
  GridColumnMenu,
  GridColumnMenuItemProps,
  GridColumnMenuProps,
  useGridApiContext,
} from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';

/**
 * Auto sizing options of the List view.
 *
 * `includeHeaders` makes a column at least as wide as its heading, and the measurement of the
 * cells already contains the cell padding, which is what double clicking a column separator
 * uses. Keeping a single shared constant guarantees that double clicking one separator and
 * "Auto size all column headings" produce exactly the same widths.
 */
export const LIST_AUTOSIZE_OPTIONS: GridAutosizeOptions = {
  includeHeaders: true,
  includeOutliers: true,
};

/**
 * "Auto size all column headings": resizes every visible column to the wider of its heading
 * and its widest value (padding included), i.e. the same result as double clicking every
 * column separator one by one.
 */
function ListColumnMenuAutosizeAllItem(props: GridColumnMenuItemProps) {
  const { onClick } = props;
  const { t } = useTranslation();
  const apiRef = useGridApiContext();

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    // `disableColumnVirtualization` makes the grid measure the columns that are scrolled out
    // of the viewport as well, which is exactly what the separator double click does.
    void apiRef.current.autosizeColumns({
      ...LIST_AUTOSIZE_OPTIONS,
      disableColumnVirtualization: false,
    });
    onClick(event);
  };

  return (
    <MenuItem onClick={handleClick}>
      <ListItemIcon>
        <SettingsEthernetIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>{t('list.columnMenu.autosizeAll')}</ListItemText>
    </MenuItem>
  );
}

/** The stock column menu plus the "Auto size all column headings" entry. */
export default function ListColumnMenu(props: GridColumnMenuProps) {
  return (
    <GridColumnMenu
      {...props}
      slots={{ columnMenuAutosizeAllItem: ListColumnMenuAutosizeAllItem }}
      slotProps={{ columnMenuAutosizeAllItem: { displayOrder: 40 } }}
    />
  );
}
