import * as React from "react";
import CheckBox from "@binders/ui-kit/lib/elements/checkbox";
import MTSettingsSection from "../MTSettings/shared/MTSettingsSection";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { setDefaultPDFExportSettings } from "../../actions";
import { withTranslation } from "@binders/client/lib/react/i18n";

class PDFExportSettings extends React.Component {

    constructor(props) {
        super(props);

        this.onUpdateRenderOnlyFirstCarrouselImage = this.onUpdateRenderOnlyFirstCarrouselImage.bind(this);
    }


    onUpdateRenderOnlyFirstCarrouselImage(renderOnlyFirstCarrouselItem) {
        const { accountId } = this.props;
        setDefaultPDFExportSettings(accountId, { renderOnlyFirstCarrouselItem });
    }

    render() {
        const { settings, t } = this.props;

        return (
            <div className="pdf-export-settings">
                <MTSettingsSection title={t(TK.Account_PdfExport)}>
                    <div className="settings-wrapper">
                        <CheckBox
                            label={t(TK.Edit_PdfPrefOneVisualChunk)}
                            checked={settings.renderOnlyFirstCarrouselItem}
                            onCheck={this.onUpdateRenderOnlyFirstCarrouselImage}
                        />
                    </div>
                </MTSettingsSection>
            </div>
        )
    }
}

export default withTranslation()(PDFExportSettings);
